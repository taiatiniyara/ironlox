import { describe, it, expect } from "vitest";
import { aesEncrypt, aesDecrypt } from "../src/aes.js";

const testKey = new Uint8Array(32);
crypto.getRandomValues(testKey);

describe("AES-256-GCM", () => {
  it("encrypts and decrypts correctly", async () => {
    const plaintext = "Hello, this is a test secret!";
    const encrypted = await aesEncrypt(plaintext, testKey);
    const decrypted = await aesDecrypt(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (random IV)", async () => {
    const plaintext = "same text";
    const enc1 = await aesEncrypt(plaintext, testKey);
    const enc2 = await aesEncrypt(plaintext, testKey);

    expect(enc1).not.toBe(enc2);
  });

  it("fails to decrypt with wrong key", async () => {
    const plaintext = "sensitive data";
    const encrypted = await aesEncrypt(plaintext, testKey);

    const wrongKey = new Uint8Array(32);
    crypto.getRandomValues(wrongKey);

    await expect(aesDecrypt(encrypted, wrongKey)).rejects.toThrow();
  });

  it("fails to decrypt truncated ciphertext", async () => {
    const encrypted = await aesEncrypt("test", testKey);
    const truncated = encrypted.slice(0, 10); // too short

    await expect(aesDecrypt(truncated, testKey)).rejects.toThrow();
  });

  it("handles empty string", async () => {
    const encrypted = await aesEncrypt("", testKey);
    const decrypted = await aesDecrypt(encrypted, testKey);

    expect(decrypted).toBe("");
  });

  it("handles unicode text", async () => {
    const plaintext = "🔐 Passwörd パスワード 🗝️";
    const encrypted = await aesEncrypt(plaintext, testKey);
    const decrypted = await aesDecrypt(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
  });

  it("handles long text (50KB)", async () => {
    const plaintext = "x".repeat(50_000);
    const encrypted = await aesEncrypt(plaintext, testKey);
    const decrypted = await aesDecrypt(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
    expect(decrypted.length).toBe(50_000);
  });
});
