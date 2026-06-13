"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getAdminApiClient, type AdminApiClient } from "@ironlox/api-client";

interface AdminContextValue {
  client: AdminApiClient;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (secret: string) => Promise<void>;
  logout: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() =>
    getAdminApiClient(process.env.NEXT_PUBLIC_API_URL ?? "https://api.ironlox.com"),
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    client.setOnExpired(() => {
      setIsAuthenticated(false);
    });
    // Check if there's a valid token on mount
    const authed = client.isAuthenticated();
    setIsAuthenticated(authed);
    setIsLoading(false);
  }, [client]);

  const login = useCallback(
    async (secret: string) => {
      await client.login(secret);
      setIsAuthenticated(true);
    },
    [client],
  );

  const logout = useCallback(() => {
    client.clearToken();
    setIsAuthenticated(false);
  }, [client]);

  return (
    <AdminContext.Provider value={{ client, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return ctx;
}
