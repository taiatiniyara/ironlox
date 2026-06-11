"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Vault, VaultItem } from "@ironlox/schemas";
import {
  createEmptyVault,
  addItemToVault,
  removeItemFromVault,
  updateItemInVault,
  encryptVault,
  decryptVault,
  deriveAuthHash,
  deriveEncryptionKey,
  generateSalt,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
} from "@ironlox/crypto";
import { createApiClient, type ApiClient } from "@ironlox/api-client";

const STORAGE_KEYS = {
  accessToken: "ironlox_access_token",
  refreshToken: "ironlox_refresh_token",
  email: "ironlox_email",
} as const;

function toHex(buf: Uint8Array): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function fetchVaultBlob(vaultUrl: string): Promise<string> {
  const res = await fetch(vaultUrl);
  if (!res.ok) throw new Error("Failed to download vault");
  return res.text();
}

async function uploadVaultBlob(uploadUrl: string, blob: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (!res.ok) throw new Error("Failed to upload vault");
}

interface VaultContextType {
  vault: Vault | null;
  isAuthenticated: boolean;
  isVaultLoaded: boolean;
  isSyncing: boolean;
  email: string | null;
  apiClient: ApiClient | null;
  vaultKey: Uint8Array | null;
  login: (email: string, masterPassword: string) => Promise<void>;
  register: (email: string, masterPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  addItem: (item: VaultItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<VaultItem>) => Promise<void>;
}

const VaultContext = createContext<VaultContextType | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vault, setVaultState] = useState<Vault | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVaultLoaded, setIsVaultLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const apiClientRef = useRef<ApiClient | null>(null);
  const vaultKeyRef = useRef<Uint8Array | null>(null);
  const vaultVersionRef = useRef<number>(1);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
    const client = createApiClient(baseUrl);

    client.setOnTokenRefresh((tokens) => {
      client.setTokens(tokens.accessToken, tokens.refreshToken);
      localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken);
      localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken);
    });

    apiClientRef.current = client;

    const storedToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const storedRefresh = localStorage.getItem(STORAGE_KEYS.refreshToken);
    const storedEmail = localStorage.getItem(STORAGE_KEYS.email);

    if (storedToken && storedRefresh) {
      client.setTokens(storedToken, storedRefresh);
      setEmail(storedEmail);
    }
  }, []);

  const persistSession = useCallback(
    (accessToken: string, refreshToken: string, userEmail: string) => {
      localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
      localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
      localStorage.setItem(STORAGE_KEYS.email, userEmail);
      apiClientRef.current?.setTokens(accessToken, refreshToken);
    },
    [],
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.email);
    apiClientRef.current?.clearTokens();
    vaultKeyRef.current = null;
    vaultVersionRef.current = 1;
    setVaultState(null);
    setIsVaultLoaded(false);
    setEmail(null);
    setIsAuthenticated(false);
  }, []);

  const syncVaultToServer = useCallback(async (updatedVault: Vault): Promise<void> => {
    const client = apiClientRef.current;
    const vaultKey = vaultKeyRef.current;
    if (!client || !vaultKey) throw new Error("Not authenticated");

    setIsSyncing(true);
    try {
      const encrypted = await encryptVault(updatedVault, vaultKey);
      const currentVersion = vaultVersionRef.current;

      const { uploadUrl, version: newVersion } = await client.putVault({
        version: currentVersion,
      });

      await uploadVaultBlob(uploadUrl, encrypted);

      vaultVersionRef.current = newVersion;
      setVaultState((prev) => (prev ? { ...prev, version: newVersion } : prev));
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const login = useCallback(
    async (userEmail: string, masterPassword: string) => {
      const client = apiClientRef.current;
      if (!client) throw new Error("API client not initialized");

      const authSalt = generateSalt();
      const authHashRaw = await deriveAuthHash(masterPassword, userEmail, authSalt);
      const authHash = toHex(authHashRaw);

      const loginResponse = await client.login({ email: userEmail, authHash });

      persistSession(loginResponse.accessToken, loginResponse.refreshToken, userEmail);
      setEmail(userEmail);
      setIsAuthenticated(true);

      const encryptionKey = await deriveEncryptionKey(
        masterPassword,
        hexToBytes(loginResponse.encryptionSalt),
      );
      const vaultKey = await unwrapVaultKey(loginResponse.wrappedVaultKey, encryptionKey);
      vaultKeyRef.current = vaultKey;
      vaultVersionRef.current = loginResponse.vaultVersion;

      const vaultUrl =
        loginResponse.vaultUrl ?? (await client.getVault()).vaultUrl;

      if (vaultUrl) {
        const blob = await fetchVaultBlob(vaultUrl);
        const decryptedVault = await decryptVault(blob, vaultKey);
        setVaultState(decryptedVault);
      } else {
        setVaultState(createEmptyVault());
      }

      setIsVaultLoaded(true);
    },
    [persistSession],
  );

  const register = useCallback(
    async (userEmail: string, masterPassword: string) => {
      const client = apiClientRef.current;
      if (!client) throw new Error("API client not initialized");

      const authSalt = generateSalt();
      const encryptionSalt = generateSalt();
      const vaultKey = generateVaultKey();

      const authHashRaw = await deriveAuthHash(masterPassword, userEmail, authSalt);
      const authHash = toHex(authHashRaw);

      const encryptionKey = await deriveEncryptionKey(masterPassword, encryptionSalt);
      const wrappedVaultKey = await wrapVaultKey(vaultKey, encryptionKey);

      const response = await client.register({
        email: userEmail,
        authHash,
        authSalt: toHex(authSalt),
        encryptionSalt: toHex(encryptionSalt),
        wrappedVaultKey,
      });

      persistSession(response.accessToken, response.refreshToken, userEmail);
      setEmail(userEmail);
      setIsAuthenticated(true);

      vaultKeyRef.current = vaultKey;
      vaultVersionRef.current = response.vaultVersion;

      const emptyVault = createEmptyVault();
      setVaultState(emptyVault);
      setIsVaultLoaded(true);

      try {
        await syncVaultToServer(emptyVault);
      } catch {
        // Vault upload can fail non-fatally on signup — retry on next mutation
      }
    },
    [persistSession, syncVaultToServer],
  );

  const logout = useCallback(async () => {
    try {
      await apiClientRef.current?.revoke();
    } catch {
      // Best-effort revocation
    }
    clearSession();
  }, [clearSession]);

  const addItem = useCallback(
    async (item: VaultItem) => {
      setVaultState((prev) => {
        const updated = addItemToVault(prev ?? createEmptyVault(), item);
        syncVaultToServer(updated).catch(() => {});
        return updated;
      });
    },
    [syncVaultToServer],
  );

  const removeItem = useCallback(
    async (id: string) => {
      setVaultState((prev) => {
        if (!prev) return prev;
        const updated = removeItemFromVault(prev, id);
        syncVaultToServer(updated).catch(() => {});
        return updated;
      });
    },
    [syncVaultToServer],
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<VaultItem>) => {
      setVaultState((prev) => {
        if (!prev) return prev;
        const updated = updateItemInVault(prev, id, updates);
        syncVaultToServer(updated).catch(() => {});
        return updated;
      });
    },
    [syncVaultToServer],
  );

  return (
    <VaultContext.Provider
      value={{
        vault,
        isAuthenticated,
        isVaultLoaded,
        isSyncing,
        email,
        apiClient: apiClientRef.current,
        vaultKey: vaultKeyRef.current,
        login,
        register,
        logout,
        addItem,
        removeItem,
        updateItem,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}
