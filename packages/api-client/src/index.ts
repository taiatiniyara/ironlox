import type { LoginResponse, AccountInfoResponse, PutVaultResponse } from "@ironlox/schemas";

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

  setOnTokenRefresh(cb: (tokens: { accessToken: string; refreshToken: string }) => void): void {
    this.config.onTokenRefresh = cb;
  }

  // --- Auth ---

  async register(body: {
    email: string;
    authHash: string;
    authSalt: string;
    encryptionSalt: string;
    wrappedVaultKey: string;
  }): Promise<LoginResponse> {
    return this.post("/auth/register", body);
  }

  async login(body: {
    email: string;
    authHash: string;
    turnstileToken?: string;
  }): Promise<LoginResponse> {
    return this.post("/auth/login", body);
  }

  async refresh(): Promise<LoginResponse> {
    if (!this.config.refreshToken) {
      throw new ApiError(401, "No refresh token available");
    }
    try {
      const result = await this.post<LoginResponse>(
        "/auth/refresh",
        { refreshToken: this.config.refreshToken },
        false,
      );
      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
      }
      return result;
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  async mfaEnable(body: { secret: string; code: string }): Promise<void> {
    return this.post("/auth/mfa/enable", body);
  }

  async mfaVerify(body: { code: string; email: string }): Promise<LoginResponse> {
    return this.post("/auth/mfa/verify", body, false);
  }

  async changeEmail(body: { newEmail: string; authHash: string }): Promise<void> {
    return this.post("/account/email", body);
  }

  async recover(body: { recoveryKey: string; email: string }): Promise<LoginResponse> {
    return this.post("/auth/recover", body, false);
  }

  async revoke(): Promise<void> {
    return this.post("/auth/revoke", {});
  }

  // --- Vault ---

  async getVault(): Promise<{ vaultUrl: string; version: number }> {
    return this.get("/vault");
  }

  async putVault(body: { version: number; vaultBlob: string }): Promise<PutVaultResponse> {
    return this.put("/vault", body);
  }

  async getVaultBlob(): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/vault/blob`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message ?? "Failed to download vault", error.code);
    }
    return response.text();
  }

  // --- Attachments ---

  async getAttachmentUrl(id: string): Promise<{ attachmentUrl: string }> {
    return this.get(`/vault/attachment/${id}`);
  }

  async putAttachment(id: string): Promise<{ success: boolean; id: string; size: number }> {
    return this.put(`/vault/attachment/${id}`, { id });
  }

  async uploadAttachment(
    id: string,
    content: ArrayBuffer,
  ): Promise<{ success: boolean; id: string; size: number }> {
    const response = await fetch(`${this.config.baseUrl}/vault/attachment/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      body: content,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        error.message ?? "Failed to upload attachment",
        error.code,
      );
    }
    return response.json();
  }

  async deleteAttachment(id: string): Promise<void> {
    return this.del(`/vault/attachment/${id}`);
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
    canRetry = true,
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
      if (response.status === 401 && auth && canRetry && this.config.refreshToken) {
        try {
          const refreshed = await this.refresh();
          this.setTokens(refreshed.accessToken, refreshed.refreshToken);
          return this.request<T>(method, path, body, auth, false);
        } catch {
          this.clearTokens();
          throw new ApiError(401, "Session expired. Please sign in again.");
        }
      }

      const error = await response.json().catch(() => ({ message: "Request failed" }));
      const data = error as { message?: string; code?: string };
      throw new ApiError(response.status, data.message ?? "Request failed", data.code);
    }

    try {
      return response.json() as Promise<T>;
    } catch {
      throw new ApiError(response.status, "Invalid response from server");
    }
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
