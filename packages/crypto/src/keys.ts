const VAULT_KEY_LENGTH = 32; // 256 bits
const AUTH_HASH_LENGTH = 32;
const SALT_LENGTH = 32;

/**
 * Generate a 32-byte random vault key at account creation.
 * This key encrypts the vault and never changes.
 */
export function generateVaultKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(VAULT_KEY_LENGTH));
}

/**
 * Generate a random salt for key derivation.
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Derive the encryption key from the master password using Argon2id.
 *
 * This key is used to wrap/unwrap the vault key (envelope encryption).
 * Never sent to the server. Never leaves the client.
 *
 * @param masterPassword - user's master password
 * @param salt - random salt (different from auth salt)
 * @returns 32-byte encryption key
 */
export async function deriveEncryptionKey(
  masterPassword: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const { argon2id } = await import("@noble/hashes/argon2.js");
  const encoder = new TextEncoder();

  const hash = argon2id(encoder.encode(masterPassword), salt, {
    t: 3,        // iterations
    m: 65536,    // 64MB memory in KiB
    p: 4,        // parallelism
    dkLen: VAULT_KEY_LENGTH,
  });

  return hash;
}

/**
 * Derive the authentication hash from the master password.
 *
 * Uses a DIFFERENT salt than the encryption key derivation.
 * This hash is sent to the server for authentication.
 * Even if the server auth hash is compromised, the encryption key is not.
 *
 * @param masterPassword - user's master password
 * @param email - user's email (used as part of the auth identity)
 * @param salt - random salt (different from encryption salt)
 * @returns 32-byte auth hash
 */
export async function deriveAuthHash(
  masterPassword: string,
  email: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const { argon2id } = await import("@noble/hashes/argon2.js");
  const encoder = new TextEncoder();

  const input = encoder.encode(`${email.toLowerCase()}:${masterPassword}`);

  const hash = argon2id(input, salt, {
    t: 3,
    m: 65536,
    p: 4,
    dkLen: AUTH_HASH_LENGTH,
  });

  return hash;
}

/**
 * Wrap (encrypt) the vault key with a derived encryption key.
 * Envelope encryption: the vault key is encrypted by the password-derived key.
 * When changing master password, only the wrapped vault key changes — not the vault contents.
 *
 * @param vaultKey - 32-byte random vault key
 * @param encryptionKey - 32-byte key derived from master password
 * @returns base64-encoded wrapped vault key (AES-256-GCM)
 */
export async function wrapVaultKey(
  vaultKey: Uint8Array,
  encryptionKey: Uint8Array,
): Promise<string> {
  const { aesEncrypt } = await import("./aes.js");
  const plaintext = toBase64Raw(vaultKey);
  return aesEncrypt(plaintext, encryptionKey);
}

/**
 * Unwrap (decrypt) the vault key using a derived encryption key.
 *
 * @param wrappedKey - base64-encoded wrapped vault key
 * @param encryptionKey - 32-byte key derived from master password
 * @returns 32-byte vault key
 */
export async function unwrapVaultKey(
  wrappedKey: string,
  encryptionKey: Uint8Array,
): Promise<Uint8Array> {
  const { aesDecrypt } = await import("./aes.js");
  const plaintext = await aesDecrypt(wrappedKey, encryptionKey);
  return fromBase64Raw(plaintext);
}

function toBase64Raw(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]!);
  }
  return btoa(binary);
}

function fromBase64Raw(base64: string): Uint8Array {
  const binary = atob(base64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}
