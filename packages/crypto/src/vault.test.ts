import { describe, it, expect } from "vitest";
import {
  encryptVault,
  decryptVault,
  createEmptyVault,
  addItemToVault,
  removeItemFromVault,
  updateItemInVault,
} from "../src/vault.js";

const vaultKey = new Uint8Array(32);
crypto.getRandomValues(vaultKey);

describe("Vault encrypt/decrypt", () => {
  it("encrypts and decrypts vault correctly", async () => {
    const vault = createEmptyVault();
    const encrypted = await encryptVault(vault, vaultKey);
    const decrypted = await decryptVault(encrypted, vaultKey);

    expect(decrypted.version).toBe(1);
    expect(decrypted.items).toEqual([]);
  });

  it("preserves vault contents through encryption round-trip", async () => {
    const vault = createEmptyVault();
    vault.items.push({
      id: crypto.randomUUID(),
      type: "login",
      name: "Test Login",
      tags: ["work", "email"],
      folderId: null,
      fields: {
        username: "user@test.com",
        password: "s3cret!",
        uris: ["https://example.com"],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const encrypted = await encryptVault(vault, vaultKey);
    const decrypted = await decryptVault(encrypted, vaultKey);

    expect(decrypted.items).toHaveLength(1);
    expect(decrypted.items[0]!.name).toBe("Test Login");
    expect("username" in decrypted.items[0]!.fields && decrypted.items[0]!.fields.username).toBe(
      "user@test.com",
    );
  });

  it("fails to decrypt with wrong key", async () => {
    const vault = createEmptyVault();
    const encrypted = await encryptVault(vault, vaultKey);

    const wrongKey = new Uint8Array(32);
    crypto.getRandomValues(wrongKey);

    await expect(decryptVault(encrypted, wrongKey)).rejects.toThrow();
  });

  it("fails on invalid JSON after decryption", async () => {
    const { aesEncrypt } = await import("../src/aes.js");
    const corrupted = await aesEncrypt("not-valid-json", vaultKey);
    await expect(decryptVault(corrupted, vaultKey)).rejects.toThrow("Invalid vault structure");
  });
});

describe("Vault item operations", () => {
  it("adds item to vault", () => {
    const vault = createEmptyVault();
    const updated = addItemToVault(vault, {
      id: crypto.randomUUID(),
      type: "note",
      name: "Test Note",
      tags: [],
      folderId: null,
      fields: { content: "secret note" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(updated.items).toHaveLength(1);
    expect(vault.items).toHaveLength(0); // original not mutated
  });

  it("soft-deletes item", () => {
    const vault = createEmptyVault();
    const id = crypto.randomUUID();
    const withItem = addItemToVault(vault, {
      id,
      type: "note",
      name: "Test",
      tags: [],
      folderId: null,
      fields: { content: "content" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const deleted = removeItemFromVault(withItem, id);
    expect(deleted.items[0]!.deleted).toBe(true);
  });

  it("updates item fields", () => {
    const vault = createEmptyVault();
    const id = crypto.randomUUID();
    const withItem = addItemToVault(vault, {
      id,
      type: "note",
      name: "Test",
      tags: [],
      folderId: null,
      fields: { content: "old" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const updated = updateItemInVault(withItem, id, { name: "Updated" });
    expect(updated.items[0]!.name).toBe("Updated");
  });
});
