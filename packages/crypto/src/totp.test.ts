import { describe, it, expect } from "vitest";
import { generateTotp, generateTotpSecret, verifyTotp, generateTotpUri } from "../src/totp.js";

// RFC 6238 test vectors — Appendix B
// Test values from the RFC
const SECRET_SHA1 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // base32("12345678901234567890")

describe("TOTP (RFC 6238)", () => {
  it("generates a valid base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(secret.length).toBeGreaterThanOrEqual(32);
  });

  it("generates a 6-digit code", async () => {
    const secret = generateTotpSecret();
    const code = await generateTotp(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("verifies a fresh code", async () => {
    const secret = generateTotpSecret();
    const code = await generateTotp(secret);
    const valid = await verifyTotp(secret, code);
    expect(valid).toBe(true);
  });

  it("rejects wrong code", async () => {
    const secret = generateTotpSecret();
    const valid = await verifyTotp(secret, "000000");
    expect(valid).toBe(false);
  });

  it("rejects empty code", async () => {
    const secret = generateTotpSecret();
    const valid = await verifyTotp(secret, "");
    expect(valid).toBe(false);
  });

  it("consistently generates the same code within a time window", async () => {
    const secret = generateTotpSecret();
    const code1 = await generateTotp(secret);
    const code2 = await generateTotp(secret);
    expect(code1).toBe(code2);
  });

  it("generates correct otpauth URI", () => {
    const uri = generateTotpUri(SECRET_SHA1, "Ironlox", "user@example.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(uri).toContain("issuer=Ironlox");
  });

  it("generates different secrets each time", () => {
    const s1 = generateTotpSecret();
    const s2 = generateTotpSecret();
    expect(s1).not.toBe(s2);
  });

  it("handles different digit counts", async () => {
    const secret = generateTotpSecret();
    const code = await generateTotp(secret, 30, 8);
    expect(code).toMatch(/^\d{8}$/);
  });
});
