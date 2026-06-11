/**
 * RFC 6238 TOTP (Time-Based One-Time Password) implementation.
 * Uses Web Crypto API for HMAC-SHA1.
 */

/**
 * Generate a random TOTP secret (base32-encoded).
 * Compatible with Google Authenticator, Authy, and other TOTP apps.
 *
 * @returns base32-encoded secret string
 */
export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20)); // 160 bits for SHA1
  return base32Encode(bytes);
}

/**
 * Generate a TOTP code for the given secret at the current time.
 *
 * @param secret - base32-encoded TOTP secret
 * @param period - time step in seconds (default 30)
 * @param digits - number of digits in the code (default 6)
 * @returns TOTP code as string
 */
export async function generateTotp(
  secret: string,
  period = 30,
  digits = 6,
): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / period);
  return computeHotp(secret, counter, digits);
}

/**
 * Verify a TOTP code against the given secret.
 * Accepts codes from adjacent time windows to account for clock drift.
 *
 * @param secret - base32-encoded TOTP secret
 * @param code - code to verify
 * @param window - number of adjacent time steps to accept (default 1 = ±30s)
 * @param period - time step in seconds (default 30)
 * @param digits - number of digits in the code (default 6)
 */
export async function verifyTotp(
  secret: string,
  code: string,
  window = 1,
  period = 30,
  digits = 6,
): Promise<boolean> {
  const counter = Math.floor(Date.now() / 1000 / period);

  for (let offset = -window; offset <= window; offset++) {
    const expected = await computeHotp(secret, counter + offset, digits);
    const { constantTimeEqual } = await import("./utils.js");
    if (constantTimeEqual(expected, code)) {
      return true;
    }
  }

  return false;
}

async function computeHotp(secret: string, counter: number, digits: number): Promise<string> {
  const key = base32Decode(secret);
  const counterBytes = new Uint8Array(8);
  const view = new DataView(counterBytes.buffer);
  view.setBigUint64(0, BigInt(counter), false); // big-endian

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBytes.buffer as ArrayBuffer);
  const sigBytes = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226 §5.4)
  const offset = sigBytes[sigBytes.length - 1]! & 0x0f;
  const binary =
    ((sigBytes[offset]! & 0x7f) << 24) |
    ((sigBytes[offset + 1]! & 0xff) << 16) |
    ((sigBytes[offset + 2]! & 0xff) << 8) |
    (sigBytes[offset + 3]! & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let result = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(buffer >> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(buffer << (5 - bits)) & 0x1f];
  }

  return result;
}

function base32Decode(base32: string): Uint8Array {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const result: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of cleaned) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      result.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(result);
}

/**
 * Generate a TOTP URI for QR code scanning.
 * otpauth://totp/issuer:account?secret=...&issuer=issuer
 */
export function generateTotpUri(secret: string, issuer: string, account: string): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params}`;
}
