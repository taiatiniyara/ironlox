const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits, recommended for GCM
const TAG_LENGTH = 128; // 128-bit authentication tag

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey.buffer as ArrayBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
  return key;
}

function generateIv(): Uint8Array {
  return new Uint8Array(crypto.getRandomValues(new Uint8Array(IV_LENGTH)));
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns base64-encoded ciphertext with IV prepended.
 *
 * @param plaintext - UTF-8 string to encrypt
 * @param key - 32-byte raw key
 * @returns base64(IV || ciphertext || tag)
 */
export async function aesEncrypt(plaintext: string, key: Uint8Array): Promise<string> {
  const cryptoKey = await importKey(key);
  const iv = generateIv();
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer, tagLength: TAG_LENGTH },
    cryptoKey,
    encoded,
  );

  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);

  return toBase64(result.buffer as ArrayBuffer);
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Expects base64(IV || ciphertext || tag) format from aesEncrypt.
 *
 * @param encryptedBase64 - base64-encoded ciphertext with IV prepended
 * @param key - 32-byte raw key
 * @returns decrypted UTF-8 string
 * @throws on authentication failure or invalid input
 */
export async function aesDecrypt(encryptedBase64: string, key: Uint8Array): Promise<string> {
  const cryptoKey = await importKey(key);
  const combined = new Uint8Array(fromBase64(encryptedBase64));

  if (combined.length < IV_LENGTH + TAG_LENGTH / 8) {
    throw new Error("Ciphertext too short for AES-GCM");
  }

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer, tagLength: TAG_LENGTH },
    cryptoKey,
    ciphertext.buffer as ArrayBuffer,
  );

  return new TextDecoder().decode(plaintext);
}
