"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
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
  mergeVaults,
  encryptVault,
  decryptVault,
  deriveAuthHash,
  deriveEncryptionKey,
  generateSalt,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  toHex,
  hexToBytes,
} from "@ironlox/crypto";
import { createApiClient, type ApiClient, ApiError } from "@ironlox/api-client";
import { queryClient } from "@/lib/query-client";
import { toast } from "sonner";

const STORAGE_KEYS = {
  accessToken: "ironlox_access_token",
  refreshToken: "ironlox_refresh_token",
  email: "ironlox_email",
} as const;

async function fetchVaultBlob(client: ApiClient): Promise<string> {
  return client.getVaultBlob();
}

interface VaultContextType {
  vault: Vault | null;
  isAuthenticated: boolean;
  isAuthRestored: boolean;
  isVaultLoaded: boolean;
  isSyncing: boolean;
  email: string | null;
  apiClient: ApiClient | null;
  vaultKey: Uint8Array | null;
  login: (email: string, masterPassword: string) => Promise<boolean>;
  register: (email: string, masterPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockVault: (masterPassword: string) => Promise<void>;
  addItem: (item: VaultItem) => Promise<void>;
  bulkAddItems: (items: VaultItem[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<VaultItem>) => Promise<void>;
}

const VaultContext = createContext<VaultContextType | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vault, setVaultState] = useState<Vault | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthRestored, setIsAuthRestored] = useState(false);
  const [isVaultLoaded, setIsVaultLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const apiClientRef = useRef<ApiClient | null>(null);
  const vaultKeyRef = useRef<Uint8Array | null>(null);
  const vaultVersionRef = useRef<number>(1);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://api.ironlox.com";
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
      setIsAuthenticated(true);
    }
    setIsVaultLoaded(true);
    setIsAuthRestored(true);
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
    queryClient.clear();
  }, []);

  const syncVaultToServer = useCallback(async (updatedVault: Vault): Promise<void> => {
    const client = apiClientRef.current;
    const vaultKey = vaultKeyRef.current;
    if (!client || !vaultKey) throw new Error("Not authenticated");

    setIsSyncing(true);
    try {
      const encrypted = await encryptVault(updatedVault, vaultKey);
      const currentVersion = vaultVersionRef.current;

      const { version: newVersion } = await client.putVault({
        version: currentVersion,
        vaultBlob: encrypted,
      });

      vaultVersionRef.current = newVersion;
      setVaultState((prev) => (prev ? { ...prev, version: newVersion } : prev));
    } catch (err) {
      if (err instanceof ApiError && err.code === "VAULT_VERSION_CONFLICT") {
        if (vaultKey) {
          const blob = await fetchVaultBlob(client!);
          const serverVault = await decryptVault(blob, vaultKey);
          const merged = mergeVaults(updatedVault, serverVault);
          const encrypted = await encryptVault(merged, vaultKey);
          const { version: retryVersion } = await client.putVault({
            version: serverVault.version,
            vaultBlob: encrypted,
          });
          vaultVersionRef.current = retryVersion;
          setVaultState(merged);
        }
      } else {
        throw err;
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const login = useCallback(
    async (userEmail: string, masterPassword: string): Promise<boolean> => {
      const client = apiClientRef.current;
      if (!client) throw new Error("API client not initialized");

      const authSalt = generateSalt();
      const authHashRaw = await deriveAuthHash(masterPassword, userEmail, authSalt);
      const authHash = toHex(authHashRaw);

      const loginResponse = await client.login({ email: userEmail, authHash });

      if (loginResponse.mfaRequired) {
        localStorage.setItem(
          "ironlox_mfa_temp",
          JSON.stringify({
            tempToken: loginResponse.tempToken,
            email: userEmail,
            encryptionSalt: loginResponse.encryptionSalt,
            wrappedVaultKey: loginResponse.wrappedVaultKey,
            vaultVersion: loginResponse.vaultVersion,
          }),
        );
        return true;
      }

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

      const vaultBlob = await client.getVaultBlob().catch(() => null);

      if (vaultBlob) {
        const blob = vaultBlob;
        const decryptedVault = await decryptVault(blob, vaultKey);
        setVaultState(decryptedVault);
      } else {
        setVaultState(createEmptyVault());
      }

      setIsVaultLoaded(true);
      queryClient.invalidateQueries({ queryKey: ["account"] });
      return false;
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

      queryClient.invalidateQueries({ queryKey: ["account"] });

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

  const unlockVault = useCallback(
    async (masterPassword: string): Promise<void> => {
      const client = apiClientRef.current;
      if (!client) throw new Error("Not authenticated");

      setIsVaultLoaded(false);
      try {
        const account = await client.getAccount();
        if (!account.encryptionSalt || !account.wrappedVaultKey) {
          throw new Error("Account not fully initialized");
        }
        const encryptionKey = await deriveEncryptionKey(
          masterPassword,
          hexToBytes(account.encryptionSalt),
        );
        const vaultKey = await unwrapVaultKey(account.wrappedVaultKey, encryptionKey);
        vaultKeyRef.current = vaultKey;
        vaultVersionRef.current = account.vaultVersion;

        const blob = await client.getVaultBlob();
        if (!blob) {
          setVaultState(createEmptyVault());
        } else {
          try {
            const decrypted = await decryptVault(blob, vaultKey);
            setVaultState(decrypted);
          } catch {
            setVaultState(createEmptyVault());
          }
        }
        setIsVaultLoaded(true);
      } catch (err) {
        setIsVaultLoaded(true);
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          throw new Error("SESSION_EXPIRED", { cause: err });
        }
        throw new Error("Failed to unlock vault. Check your master password.", { cause: err });
      }
    },
    [clearSession],
  );

  const addItem = useCallback(
    async (item: VaultItem) => {
      const updated = addItemToVault(vault ?? createEmptyVault(), item);
      setVaultState(updated);
      syncVaultToServer(updated).catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Sync failed");
      });
    },
    [vault, syncVaultToServer],
  );

  const bulkAddItems = useCallback(
    async (items: VaultItem[]) => {
      let updated = vault ?? createEmptyVault();
      for (const item of items) {
        updated = addItemToVault(updated, item);
      }
      setVaultState(updated);
      syncVaultToServer(updated).catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Sync failed");
      });
    },
    [vault, syncVaultToServer],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!vault) return;
      const updated = removeItemFromVault(vault, id);
      setVaultState(updated);
      syncVaultToServer(updated).catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Sync failed");
      });
    },
    [vault, syncVaultToServer],
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<VaultItem>) => {
      if (!vault) return;
      const updated = updateItemInVault(vault, id, updates);
      setVaultState(updated);
      syncVaultToServer(updated).catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Sync failed");
      });
    },
    [vault, syncVaultToServer],
  );

  const contextValue = useMemo(
    () => ({
      vault,
      isAuthenticated,
      isAuthRestored,
      isVaultLoaded,
      isSyncing,
      email,
      apiClient: apiClientRef.current,
      vaultKey: vaultKeyRef.current,
      login,
      register,
      logout,
      unlockVault,
      addItem,
      bulkAddItems,
      removeItem,
      updateItem,
    }),
    [
      vault,
      isAuthenticated,
      isAuthRestored,
      isVaultLoaded,
      isSyncing,
      email,
      login,
      register,
      logout,
      addItem,
      bulkAddItems,
      removeItem,
      updateItem,
    ],
  );

  return <VaultContext.Provider value={contextValue}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}
