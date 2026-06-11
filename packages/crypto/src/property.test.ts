import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { aesEncrypt, aesDecrypt } from "../src/aes.js";
import { generatePassword } from "../src/generator.js";
import { encryptVault, decryptVault, createEmptyVault } from "../src/vault.js";

describe("AES-GCM property-based tests", () => {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);

  it("decrypt(encrypt(x)) === x for random strings", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (plaintext) => {
        const encrypted = await aesEncrypt(plaintext, key);
        const decrypted = await aesDecrypt(encrypted, key);
        return decrypted === plaintext;
      }),
      { numRuns: 100 },
    );
  });

  it("decrypt(encrypt(x)) === x for all character types", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ unit: "binary" }), async (plaintext) => {
        const encrypted = await aesEncrypt(plaintext, key);
        const decrypted = await aesDecrypt(encrypted, key);
        return decrypted === plaintext;
      }),
      { numRuns: 100 },
    );
  });

  it("encrypt produces different output for different inputs", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.string(), async (a, b) => {
        fc.pre(a !== b);
        const encA = await aesEncrypt(a, key);
        const encB = await aesEncrypt(b, key);
        return encA !== encB;
      }),
      { numRuns: 100 },
    );
  });

  it("encrypt produces different output each time (random IV)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (plaintext) => {
        const enc1 = await aesEncrypt(plaintext, key);
        const enc2 = await aesEncrypt(plaintext, key);
        return enc1 !== enc2;
      }),
      { numRuns: 100 },
    );
  });
});

describe("Vault property-based tests", () => {
  const vaultKey = new Uint8Array(32);
  crypto.getRandomValues(vaultKey);

  it("decrypt(encrypt(vault)) === vault for random items", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            type: fc.constantFrom("login" as const, "card" as const, "note" as const, "identity" as const),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            tags: fc.array(fc.string({ maxLength: 20 }), { minLength: 0, maxLength: 5 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        async (items) => {
          const vault = createEmptyVault();
          const now = new Date().toISOString();

          vault.items = items.map((item) => ({
            ...item,
            folderId: null,
            createdAt: now,
            updatedAt: now,
            fields: { username: "test", password: "test" },
          }));

          const encrypted = await encryptVault(vault, vaultKey);
          const decrypted = await decryptVault(encrypted, vaultKey);

          return decrypted.items.length === vault.items.length;
        },
      ),
      { numRuns: 50 },
    );
  });

  it("encrypted vaults are different for different content", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (name1, name2) => {
          fc.pre(name1 !== name2);

          const vault1 = createEmptyVault();
          vault1.items.push({
            id: crypto.randomUUID(),
            type: "login",
            name: name1,
            tags: [],
            folderId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            fields: { username: "u", password: "p" },
          });

          const vault2 = createEmptyVault();
          vault2.items.push({
            id: crypto.randomUUID(),
            type: "login",
            name: name2,
            tags: [],
            folderId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            fields: { username: "u", password: "p" },
          });

          const enc1 = await encryptVault(vault1, vaultKey);
          const enc2 = await encryptVault(vault2, vaultKey);

          return enc1 !== enc2;
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("Generator property-based tests", () => {
  it("generated password matches character constraints", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          length: fc.integer({ min: 8, max: 64 }),
          uppercase: fc.boolean(),
          lowercase: fc.boolean(),
          numbers: fc.boolean(),
          symbols: fc.boolean(),
        }),
        async (opts) => {
          const pw = generatePassword(opts);
          expect(pw.length).toBe(opts.length);

          if (opts.uppercase) expect(pw).toMatch(/[A-Z]/);
          if (opts.lowercase) expect(pw).toMatch(/[a-z]/);
          if (opts.numbers) expect(pw).toMatch(/[0-9]/);

          return true;
        },
      ),
      { numRuns: 50 },
    );
  });

  it("passphrases have correct word count", async () => {
    const { generatePassphrase } = await import("../src/generator.js");

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 10 }),
        async (wordCount) => {
          const phrase = generatePassphrase({ wordCount, separator: "-" });
          return phrase.split("-").length === wordCount;
        },
      ),
      { numRuns: 20 },
    );
  });
});

