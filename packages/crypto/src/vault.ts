import type { Vault } from "@ironlox/schemas";
import { aesEncrypt, aesDecrypt } from "./aes.js";

/**
 * Merge two vaults using last-write-wins conflict resolution.
 * Newer items (by updatedAt) win when both local and server have the same item.
 * Items only in local are added; items only in server are kept.
 */
export function mergeVaults(local: Vault, server: Vault): Vault {
  const serverMap = new Map(server.items.map((i) => [i.id, i]));
  for (const localItem of local.items) {
    const serverItem = serverMap.get(localItem.id);
    if (!serverItem) {
      serverMap.set(localItem.id, localItem);
    } else if (localItem.updatedAt > serverItem.updatedAt) {
      serverMap.set(localItem.id, localItem);
    }
  }
  return {
    version: server.version,
    items: [...serverMap.values()],
  };
}

/**
 * Encrypt the entire vault with the vault key.
 * Serializes vault to JSON, encrypts with AES-256-GCM.
 *
 * @param vault - plaintext vault object
 * @param vaultKey - 32-byte vault key
 * @returns base64-encoded encrypted vault blob
 */
export async function encryptVault(vault: Vault, vaultKey: Uint8Array): Promise<string> {
  const json = JSON.stringify(vault);
  return aesEncrypt(json, vaultKey);
}

/**
 * Decrypt an encrypted vault blob.
 * Decrypts with AES-256-GCM, parses JSON.
 *
 * @param encryptedBlob - base64-encoded encrypted vault blob
 * @param vaultKey - 32-byte vault key
 * @returns parsed Vault object
 */
export async function decryptVault(
  encryptedBlob: string,
  vaultKey: Uint8Array,
): Promise<Vault> {
  const json = await aesDecrypt(encryptedBlob, vaultKey);

  let vault: unknown;
  try {
    vault = JSON.parse(json);
  } catch {
    throw new Error("Invalid vault structure after decryption");
  }

  const v = vault as Vault;
  if (!v.version || !Array.isArray(v.items)) {
    throw new Error("Invalid vault structure after decryption");
  }

  return v;
}

/**
 * Create a new empty vault.
 *
 * @returns empty Vault with version 1
 */
export function createEmptyVault(): Vault {
  return {
    version: 1,
    items: [],
  };
}

/**
 * Add an item to the vault and return a new vault reference.
 * Does NOT mutate the original vault.
 *
 * @param vault - current vault
 * @param item - item to add
 * @returns new vault with item added
 */
export function addItemToVault(vault: Vault, item: Vault["items"][number]): Vault {
  return {
    ...vault,
    items: [...vault.items, item],
  };
}

/**
 * Remove an item from the vault by soft-delete (marks deleted: true).
 * Does NOT mutate the original vault.
 *
 * @param vault - current vault
 * @param itemId - UUID of item to soft-delete
 * @returns new vault with item soft-deleted
 */
export function removeItemFromVault(vault: Vault, itemId: string): Vault {
  return {
    ...vault,
    items: vault.items.map((item) =>
      item.id === itemId ? { ...item, deleted: true, updatedAt: new Date().toISOString() } : item,
    ),
  };
}

/**
 * Update an existing item in the vault.
 * Does NOT mutate the original vault.
 *
 * @param vault - current vault
 * @param itemId - UUID of item to update
 * @param updates - partial item fields to update
 * @returns new vault with item updated
 */
export function updateItemInVault(
  vault: Vault,
  itemId: string,
  updates: Partial<Vault["items"][number]>,
): Vault {
  return {
    ...vault,
    items: vault.items.map((item) =>
      item.id === itemId
        ? { ...item, ...updates, updatedAt: new Date().toISOString() }
        : item,
    ),
  };
}
