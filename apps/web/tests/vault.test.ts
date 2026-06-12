import { describe, it, expect } from "vitest";
import { createEmptyVault, addItemToVault, removeItemFromVault, updateItemInVault } from "@ironlox/crypto";
import type { VaultItem } from "@ironlox/schemas";

const makeItem = (overrides: Partial<VaultItem> = {}): VaultItem => ({
  id: crypto.randomUUID(),
  type: "login",
  name: "Test Item",
  tags: [],
  folderId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  fields: { username: "test", password: "secret" },
  ...overrides,
} as VaultItem);

describe("vault CRUD", () => {
  it("creates an empty vault", () => {
    const vault = createEmptyVault();
    expect(vault.version).toBe(1);
    expect(vault.items).toEqual([]);
  });

  it("adds an item", () => {
    const vault = createEmptyVault();
    const item = makeItem();
    const updated = addItemToVault(vault, item);
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]!.name).toBe("Test Item");
  });

  it("soft-deletes an item", () => {
    const vault = createEmptyVault();
    const item = makeItem();
    const withItem = addItemToVault(vault, item);
    const deleted = removeItemFromVault(withItem, item.id);
    expect(deleted.items).toHaveLength(1);
    expect(deleted.items[0]!.deleted).toBe(true);
  });

  it("updates an item", () => {
    const vault = createEmptyVault();
    const item = makeItem();
    const withItem = addItemToVault(vault, item);
    const updated = updateItemInVault(withItem, item.id, { name: "Updated" });
    expect(updated.items[0]!.name).toBe("Updated");
  });

  it("does not mutate original vault", () => {
    const vault = createEmptyVault();
    const item = makeItem();
    const updated = addItemToVault(vault, item);
    expect(vault.items).toHaveLength(0);
    expect(updated.items).toHaveLength(1);
  });
});
