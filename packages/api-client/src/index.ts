import type {
  LoginResponse,
  AccountInfoResponse,
  PutVaultResponse,
} from "@ironlox/schemas";

/**
 * Ironlox API client.
 * Typed HTTP client for the Cloudflare Workers API.
 * All API calls go through this client — never use raw fetch().
 *
 * This is a placeholder that will be replaced with the full Hono RPC client
 * once the worker API routes are defined.
 * See: https://hono.dev/docs/guides/rpc
 */

export interface ApiClientConfig {
  baseUrl: string;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  onTokenRefresh?: ((tokens: { accessToken: string; refreshToken: string }) => void) | undefined;
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.config.accessToken = accessToken;
    this.config.refreshToken = refreshToken;
  }

  clearTokens(): void {
    this.config.accessToken = undefined;
    this.config.refreshToken = undefined;
  }

  // --- Auth ---

  async register(body: { email: string; authHash: string; authSalt: string; encryptionSalt: string; wrappedVaultKey: string }): Promise<LoginResponse> {
    return this.post("/auth/register", body);
  }

  async login(body: { email: string; authHash: string }): Promise<LoginResponse> {
    return this.post("/auth/login", body);
  }

  async refresh(body: { refreshToken: string }): Promise<LoginResponse> {
    return this.post("/auth/refresh", body, false);
  }

  // --- Vault ---

  async getVault(): Promise<{ vaultUrl: string; version: number }> {
    return this.get("/vault");
  }

  async putVault(body: { version: number }): Promise<PutVaultResponse> {
    return this.put("/vault", body);
  }

  // --- Attachments ---

  async getAttachmentUrl(id: string): Promise<{ attachmentUrl: string }> {
    return this.get(`/vault/attachment/${id}`);
  }

  // --- Account ---

  async getAccount(): Promise<AccountInfoResponse> {
    return this.get("/account");
  }

  async deleteAccount(): Promise<void> {
    return this.del("/account");
  }

  async undeleteAccount(): Promise<void> {
    return this.post("/account/undelete", {});
  }

  async changePassword(body: {
    currentEncryptionSalt: string;
    newEncryptionSalt: string;
    newWrappedVaultKey: string;
    newAuthHash: string;
    newAuthSalt: string;
  }): Promise<void> {
    return this.put("/account/password", body);
  }

  // --- HTTP helpers ---

  private async get<T>(path: string): Promise<T> {
    return this.request("GET", path);
  }

  private async post<T>(path: string, body: unknown, auth = true): Promise<T> {
    return this.request("POST", path, body, auth);
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    return this.request("PUT", path, body);
  }

  private async del<T>(path: string): Promise<T> {
    return this.request("DELETE", path);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auth = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (auth && this.config.accessToken) {
      headers["Authorization"] = `Bearer ${this.config.accessToken}`;
    }

    const requestBody = body ? JSON.stringify(body) : undefined;

    const init: RequestInit = {
      method,
      headers,
    };
    if (requestBody !== undefined) {
      init.body = requestBody;
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, init);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      const data = error as { message?: string; code?: string };
      throw new ApiError(response.status, data.message ?? "Request failed", data.code);
    }

    return response.json() as Promise<T>;
  }
}

export class ApiError extends Error {
  status: number;
  code: string | undefined;

  constructor(status: number, message: string, code?: string | undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const apiClient = new ApiClient({ baseUrl: "" });

export function createApiClient(baseUrl: string): ApiClient {
  return new ApiClient({ baseUrl });
}
