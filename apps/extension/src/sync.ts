import { createApiClient, type ApiClient, ApiError } from "@ironlox/api-client";
import {
  encryptVault,
  decryptVault,
  createEmptyVault,
  deriveEncryptionKey,
  deriveAuthHash,
  unwrapVaultKey,
  toHex,
  mergeVaults,
} from "@ironlox/crypto";
import type { Vault } from "@ironlox/schemas";

const DB_NAME = "ironlox-vault-cache";
const DB_VERSION = 1;
const STORE_NAME = "vaults";

interface SyncState {
  vault: Vault;
  version: number;
  lastSynced: number;
}

interface Credentials {
  email: string;
  vaultKey: Uint8Array;
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
  private vaultKey: Uint8Array | null = null;
  private accessToken: string | null = null;
  private email: string | null = null;
  private apiClient: ApiClient;

  constructor(apiUrl: string) {
    this.apiClient = createApiClient(apiUrl);
    this.apiClient.setOnTokenRefresh((tokens) => {
      this.accessToken = tokens.accessToken;
      this.apiClient.setTokens(tokens.accessToken, tokens.refreshToken);
      chrome.storage.local.set({
        ironlox_access: tokens.accessToken,
        ironlox_refresh: tokens.refreshToken,
      });
    });
  }

  getEmail(): string | null {
    return this.email;
  }
  isAuthenticated(): boolean {
    return !!(this.accessToken && this.vaultKey);
  }
  getVaultKey(): Uint8Array | null {
    return this.vaultKey;
  }

  setAuth(accessToken: string, _refreshToken: string, vaultKey: Uint8Array, email: string): void {
    this.accessToken = accessToken;
    this.vaultKey = vaultKey;
    this.email = email;
    this.apiClient.setTokens(accessToken, _refreshToken);
    chrome.storage.local.set({
      ironlox_access: accessToken,
      ironlox_refresh: _refreshToken,
      ironlox_email: email,
    });
  }

  clearAuth(): void {
    this.accessToken = null;
    this.vaultKey = null;
    this.email = null;
    this.apiClient.clearTokens();
    chrome.storage.local.remove(["ironlox_access", "ironlox_refresh", "ironlox_email"]);
  }

  async login(masterPassword: string, email: string): Promise<Credentials> {
    const authSalt = crypto.getRandomValues(new Uint8Array(32));
    const authHashRaw = await deriveAuthHash(masterPassword, email, authSalt);
    const authHash = toHex(new Uint8Array(authHashRaw));

    const loginResponse = await this.apiClient.login({ email, authHash });

    const encSalt = new Uint8Array(
      loginResponse.encryptionSalt.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
    );
    const encryptionKey = await deriveEncryptionKey(masterPassword, encSalt);
    const vaultKey = await unwrapVaultKey(loginResponse.wrappedVaultKey, encryptionKey);

    this.setAuth(loginResponse.accessToken, loginResponse.refreshToken, vaultKey, email);
    return { email, vaultKey };
  }

  async pull(): Promise<SyncState> {
    if (!this.vaultKey) throw new Error("Not authenticated");

    const encryptedBlob = await this.apiClient.getVaultBlob().catch(() => null);
    if (!encryptedBlob) {
      const vault = createEmptyVault();
      return { vault, version: 1, lastSynced: Date.now() };
    }

    const vault = await decryptVault(encryptedBlob, this.vaultKey);

    await setInCache("encrypted-vault", { blob: encryptedBlob, version: vault.version });

    return { vault, version: vault.version, lastSynced: Date.now() };
  }

  async push(vault: Vault, currentVersion: number): Promise<number> {
    if (!this.vaultKey) throw new Error("No vault key set");
    try {
      const encryptedBlob = await encryptVault(vault, this.vaultKey);
      const { version } = await this.apiClient.putVault({
        version: currentVersion,
        vaultBlob: encryptedBlob,
      });
      return version;
    } catch (err) {
      if (err instanceof ApiError && err.code === "VAULT_VERSION_CONFLICT") {
        const serverState = await this.pull();
        const merged = mergeVaults(vault, serverState.vault);
        const encryptedBlob = await encryptVault(merged, this.vaultKey);
        const { version } = await this.apiClient.putVault({
          version: serverState.version,
          vaultBlob: encryptedBlob,
        });
        return version;
      }
      throw err;
    }
  }

  async loadOffline(): Promise<SyncState | null> {
    const cached = await getFromCache("encrypted-vault");
    if (!cached || !this.vaultKey) return null;
    try {
      const data = cached as { blob: string; version: number };
      const vault = await decryptVault(data.blob, this.vaultKey);
      return { vault, version: data.version, lastSynced: Date.now() };
    } catch {
      return null;
    }
  }
}

export const vaultSync = new VaultSync(
  process.env.PLASMO_PUBLIC_API_URL ?? "http://localhost:8787",
);
