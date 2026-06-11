"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Vault, VaultItem } from "@ironlox/schemas";
import { createEmptyVault, addItemToVault, removeItemFromVault, updateItemInVault } from "@ironlox/crypto";

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  accessToken: string | null;
}

interface VaultContextType {
  vault: Vault;
  auth: AuthState;
  login: (email: string, accessToken: string) => void;
  logout: () => void;
  addItem: (item: VaultItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<VaultItem>) => void;
  setVault: (vault: Vault) => void;
}

const VaultContext = createContext<VaultContextType | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vault, setVaultState] = useState<Vault>(createEmptyVault());
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    email: null,
    accessToken: null,
  });

  const login = useCallback((email: string, accessToken: string) => {
    setAuth({ isAuthenticated: true, email, accessToken });
  }, []);

  const logout = useCallback(() => {
    setAuth({ isAuthenticated: false, email: null, accessToken: null });
    setVaultState(createEmptyVault());
  }, []);

  const addItem = useCallback((item: VaultItem) => {
    setVaultState((prev) => addItemToVault(prev, item));
  }, []);

  const removeItem = useCallback((id: string) => {
    setVaultState((prev) => removeItemFromVault(prev, id));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<VaultItem>) => {
    setVaultState((prev) => updateItemInVault(prev, id, updates));
  }, []);

  const setVault = useCallback((vault: Vault) => {
    setVaultState(vault);
  }, []);

  return (
    <VaultContext.Provider
      value={{ vault, auth, login, logout, addItem, removeItem, updateItem, setVault }}
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
