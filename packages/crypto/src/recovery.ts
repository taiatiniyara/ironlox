/**
 * Recovery key generation and hashing.
 */

const RECOVERY_KEY_LENGTH = 32; // 32 random characters
const RECOVERY_KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a random recovery key string.
 * 32 characters from lowercase alphanumeric set.
 *
 * @returns recovery key string
 */
export function generateRecoveryKey(): string {
  const chars = new Uint8Array(RECOVERY_KEY_LENGTH);
  crypto.getRandomValues(chars);
  let result = "";
  for (const byte of chars) {
    result += RECOVERY_KEY_ALPHABET[byte! % RECOVERY_KEY_ALPHABET.length];
  }
  return result;
}

/**
 * Hash a recovery key for server-side storage.
 * Uses SHA-256 with a salt.
 *
 * @param recoveryKey - plaintext recovery key
 * @param salt - random salt
 * @returns hex-encoded hash
 */
export async function hashRecoveryKey(
  recoveryKey: string,
  salt: Uint8Array,
): Promise<string> {
  const encoder = new TextEncoder();
  const combined = new Uint8Array(salt.length + encoder.encode(recoveryKey).length);
  combined.set(salt, 0);
  combined.set(encoder.encode(recoveryKey), salt.length);

  const hash = await crypto.subtle.digest("SHA-256", combined);
  return bufferToHex(new Uint8Array(hash));
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
