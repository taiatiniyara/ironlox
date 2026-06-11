// Ironlox — Sync Client
// Handles vault fetch, decrypt, encrypt, upload with optimistic locking.
// Caches encrypted vault in IndexedDB for offline read access.

import { createApiClient } from "@ironlox/api-client";
import { encryptVault, decryptVault, createEmptyVault } from "@ironlox/crypto";
import type { Vault } from "@ironlox/schemas";

const DB_NAME = "ironlox-vault-cache";
const DB_VERSION = 1;
const STORE_NAME = "vaults";

interface SyncState {
  vault: Vault;
  version: number;
  lastSynced: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromCache(key: string): Promise<unknown | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function setInCache(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, value, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class VaultSync {
  private apiUrl: string;
  private vaultKey: Uint8Array | null = null;
  private accessToken: string | null = null;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  setAuth(accessToken: string, vaultKey: Uint8Array): void {
    this.accessToken = accessToken;
    this.vaultKey = vaultKey;
  }

  clearAuth(): void {
    this.accessToken = null;
    this.vaultKey = null;
  }

  /**
   * Pull the latest vault from the server.
   * Decrypts it locally and caches in IndexedDB for offline access.
   *
   * @returns { vault, version } with the decrypted vault
   */
  async pull(): Promise<SyncState> {
    if (!this.accessToken || !this.vaultKey) {
      throw new Error("Not authenticated");
    }

    const client = createApiClient(this.apiUrl);
    client.setTokens(this.accessToken, "");

    const { vaultUrl, version: _version } = await client.getVault();

    if (!vaultUrl) {
      // No vault yet — create empty
      const vault = createEmptyVault();
      return { vault, version: 1, lastSynced: Date.now() };
    }

    const response = await fetch(`${this.apiUrl}/vault`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    const data = (await response.json()) as { vaultUrl: string; version: number };

    if (data.vaultUrl) {
      const blobResponse = await fetch(data.vaultUrl);
      const encryptedBlob = await blobResponse.text();
      const vault = await decryptVault(encryptedBlob, this.vaultKey);

      const state: SyncState = {
        vault,
        version: data.version,
        lastSynced: Date.now(),
      };

      // Cache encrypted blob + decrypted vault in IndexedDB
      await setInCache("encrypted-vault", {
        blob: encryptedBlob,
        version: data.version,
      });
      await setInCache("decrypted-vault", state);

      return state;
    }

    const vault = createEmptyVault();
    return { vault, version: 1, lastSynced: Date.now() };
  }

  /**
   * Push local vault changes to server.
   * Uses optimistic locking: version must match server version.
   *
   * @param vault - current local vault state
   * @param currentVersion - version we're overwriting
   * @throws on version conflict (409)
   */
  async push(vault: Vault, currentVersion: number): Promise<number> {
    if (!this.vaultKey) {
      throw new Error("No vault key set");
    }

    const client = createApiClient(this.apiUrl);
    if (this.accessToken) client.setTokens(this.accessToken, "");

    // Encrypt vault blob
    const encryptedBlob = await encryptVault(vault, this.vaultKey);

    // Get signed upload URL
    const { uploadUrl, version } = await client.putVault({ version: currentVersion });

    // Upload encrypted blob
    await fetch(uploadUrl, {
      method: "PUT",
      body: encryptedBlob,
      headers: { "Content-Type": "application/octet-stream" },
    });

    return version;
  }

  /**
   * Load vault from IndexedDB cache (offline).
   * Returns null if no cached vault exists.
   */
  async loadOffline(): Promise<SyncState | null> {
    const cached = await getFromCache("decrypted-vault");
    return cached as SyncState | null;
  }
}

export const vaultSync = new VaultSync("");
