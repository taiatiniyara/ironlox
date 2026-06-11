import { describe, it, expect } from "vitest";
import { generateRecoveryKey, hashRecoveryKey } from "../src/recovery.js";

describe("Recovery key", () => {
  it("generates recovery key of correct length", () => {
    const key = generateRecoveryKey();
    expect(key.length).toBe(32);
  });

  it("generates only alphanumeric lowercase", () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(/^[a-z0-9]+$/);
  });

  it("generates different keys each time", () => {
    const k1 = generateRecoveryKey();
    const k2 = generateRecoveryKey();
    expect(k1).not.toBe(k2);
  });

  it("hashes recovery key with salt", async () => {
    const key = generateRecoveryKey();
    const salt = new Uint8Array(32);
    crypto.getRandomValues(salt);

    const hash = await hashRecoveryKey(key, salt);
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex = 64 chars
  });

  it("produces different hashes for different keys", async () => {
    const salt = new Uint8Array(32);
    crypto.getRandomValues(salt);

    const hash1 = await hashRecoveryKey("key1", salt);
    const hash2 = await hashRecoveryKey("key2", salt);

    expect(hash1).not.toBe(hash2);
  });
});
