import type {
  AdminLoginResponse,
  AdminStatsResponse,
  AdminUserListResponse,
  AdminUserDetailResponse,
} from "@ironlox/schemas";

const ADMIN_TOKEN_KEY = "ironlox_admin_token";

class AdminApiError extends Error {
  status: number;
  code: string | undefined;

  constructor(status: number, message: string, code?: string | undefined) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

export class AdminApiClient {
  private baseUrl: string;
  private onExpired?: () => void;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setOnExpired(cb: () => void): void {
    this.onExpired = cb;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  }

  private setToken(token: string): void {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    }
  }

  clearToken(): void {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  async login(secret: string): Promise<AdminLoginResponse> {
    const result = await this.post<AdminLoginResponse>("/login", { secret }, false);
    this.setToken(result.accessToken);
    return result;
  }

  async getStats(): Promise<AdminStatsResponse> {
    return this.get("/stats");
  }

  async getUsers(params?: {
    q?: string;
    tier?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminUserListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.tier) searchParams.set("tier", params.tier);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return this.get(`/users${qs ? `?${qs}` : ""}`);
  }

  async getUser(id: string): Promise<AdminUserDetailResponse> {
    return this.get(`/users/${id}`);
  }

  async updateUserTier(
    id: string,
    tier: "free" | "premium",
  ): Promise<{ success: boolean; tier: string }> {
    return this.patch(`/users/${id}/tier`, { tier });
  }

  async suspendUser(id: string): Promise<{ success: boolean }> {
    return this.post(`/users/${id}/suspend`, {});
  }

  async unsuspendUser(id: string): Promise<{ success: boolean }> {
    return this.post(`/users/${id}/unsuspend`, {});
  }

  async getUserEvents(
    id: string,
    limit?: number,
  ): Promise<{
    events: Array<{ timestamp: string; ipHash: string; userAgent: string; cityCountry: string }>;
  }> {
    const qs = limit ? `?limit=${limit}` : "";
    return this.get(`/users/${id}/events${qs}`);
  }

  async getAuditLog(params?: {
    action?: string;
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    entries: Array<{
      id: number;
      action: string;
      targetType: string | null;
      targetId: string | null;
      details: string | null;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.action) searchParams.set("action", params.action);
    if (params?.q) searchParams.set("q", params.q);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return this.get(`/audit-log${qs ? `?${qs}` : ""}`);
  }

  async getFeatureFlags(): Promise<{
    flags: Array<{ key: string; value: string }>;
  }> {
    return this.get("/feature-flags");
  }

  async updateFeatureFlag(
    key: string,
    value: string,
  ): Promise<{
    success: boolean;
    key: string;
    value: string;
  }> {
    return this.put(`/feature-flags/${key}`, { value });
  }

  private async get<T>(path: string): Promise<T> {
    return this.request("GET", path);
  }

  private async post<T>(path: string, body: unknown, auth = true): Promise<T> {
    return this.request("POST", path, body, auth);
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    return this.request("PUT", path, body);
  }

  private async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request("PATCH", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (auth) {
      const token = this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}/admin${path}`, init);

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        this.onExpired?.();
      }

      const error = await response.json().catch(() => ({ message: "Request failed" }));
      const data = error as { message?: string; code?: string };
      throw new AdminApiError(response.status, data.message ?? "Request failed", data.code);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    try {
      return response.json() as Promise<T>;
    } catch {
      throw new AdminApiError(response.status, "Invalid response from server");
    }
  }
}

let adminClientInstance: AdminApiClient | null = null;

export function getAdminApiClient(baseUrl?: string): AdminApiClient {
  if (!adminClientInstance && baseUrl) {
    adminClientInstance = new AdminApiClient(baseUrl);
  }
  if (!adminClientInstance) {
    throw new Error("AdminApiClient not initialized. Provide a baseUrl.");
  }
  return adminClientInstance;
}
