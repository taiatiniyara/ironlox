"use client";

import { Providers } from "@/components/providers";
import { useVault } from "@/lib/vault-context";
import { useState } from "react";
import { createApiClient } from "@ironlox/api-client";
import { deriveAuthHash, deriveEncryptionKey, generateSalt, generateVaultKey, wrapVaultKey } from "@ironlox/crypto";

function HomeContent() {
  const { auth } = useVault();
  const [view, setView] = useState<"login" | "signup">("login");

  if (auth.isAuthenticated) {
    return <AppShell />;
  }

  return <AuthScreen view={view} setView={setView} />;
}

function AuthScreen({
  view,
  setView,
}: {
  view: "login" | "signup";
  setView: (v: "login" | "signup") => void;
}) {
  const { login } = useVault();
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [strength, setStrength] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const apiClient = createApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const authSalt = generateSalt();
      const encryptionSalt = generateSalt();
      const vaultKey = generateVaultKey();

      const authHashRaw = await deriveAuthHash(masterPassword, email, authSalt);
      const authHash = Array.from(new Uint8Array(authHashRaw))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const encryptionKey = await deriveEncryptionKey(masterPassword, encryptionSalt);
      const wrappedVaultKey = await wrapVaultKey(vaultKey, encryptionKey);

      const toHex = (buf: Uint8Array): string =>
        Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      if (view === "login") {
        const response = await apiClient.login({ email, authHash });
        login(email, response.accessToken);
        apiClient.setTokens(response.accessToken, response.refreshToken);
      } else {
        const response = await apiClient.register({
          email,
          authHash,
          authSalt: toHex(authSalt),
          encryptionSalt: toHex(encryptionSalt),
          wrappedVaultKey,
        });
        login(email, response.accessToken);
        apiClient.setTokens(response.accessToken, response.refreshToken);
      }
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? (view === "login" ? "Invalid email or password" : "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  async function checkPasswordStrength(password: string) {
    setMasterPassword(password);
    if (password.length >= 12) setStrength(3);
    else if (password.length >= 8) setStrength(2);
    else if (password.length >= 4) setStrength(1);
    else setStrength(0);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Ironlox" className="h-10 w-auto mx-auto mb-2" />
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Zero-knowledge password manager
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold">{view === "login" ? "Sign In" : "Create Account"}</h2>

          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">
              Master Password
            </label>
            <input
              type="password"
              required
              value={masterPassword}
              onChange={(e) => checkPasswordStrength(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="Your master password"
            />
            {view === "signup" && masterPassword && (
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded ${
                      level <= strength
                        ? strength <= 2
                          ? "bg-[var(--color-warning)]"
                          : "bg-[var(--color-success)]"
                        : "bg-[var(--color-border)]"
                    }`}
                  />
                ))}
                <span className="text-[10px] text-[var(--color-text-muted)] ml-2">
                  {strength <= 1 ? "Weak" : strength === 2 ? "Fair" : "Strong"}
                </span>
              </div>
            )}
          </div>

          {error && (
            <p className="text-[var(--color-danger)] text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : view === "login" ? "Unlock Vault" : "Create Account"}
          </button>

          <p className="text-center text-xs text-[var(--color-text-muted)]">
            {view === "login" ? (
              <>
                No account?{" "}
                <button
                  type="button"
                  onClick={() => setView("signup")}
                  className="text-[var(--color-accent)] hover:underline"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Have an account?{" "}
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="text-[var(--color-accent)] hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

function AppShell() {
  const { vault, logout } = useVault();
  const [tab, setTab] = useState<"vault" | "add" | "settings">("vault");
  const [search, setSearch] = useState("");

  const filtered = search
    ? vault.items.filter(
        (item) =>
          !item.deleted &&
          item.name.toLowerCase().includes(search.toLowerCase()),
      )
    : vault.items.filter((item) => !item.deleted);

  return (
    <div className="min-h-screen flex flex-col max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)]">
        <img src="/logo.svg" alt="Ironlox" className="h-7 w-auto" />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTab("settings")}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Settings
          </button>
          <button
            onClick={logout}
            className="text-xs text-[var(--color-danger)] hover:underline"
          >
            Lock
          </button>
        </div>
      </header>

      {/* Search */}
      {tab === "vault" && (
        <div className="px-6 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${vault.items.filter((i) => !i.deleted).length} items...`}
            className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      )}

      {/* Content */}
      <main className="flex-1 px-6 py-3">
        {tab === "vault" && (
          <VaultList items={filtered} onAdd={() => setTab("add")} />
        )}
        {tab === "add" && <AddItem onDone={() => setTab("vault")} />}
        {tab === "settings" && <SettingsPanel />}
      </main>

      {/* Bottom nav */}
      <nav className="flex border-t border-[var(--color-border)]">
        {(["vault", "add", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              tab === t
                ? "text-[var(--color-text)] border-t-2 border-[var(--color-accent)] -mt-px"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t === "vault" ? "Vault" : t === "add" ? "Add" : "Settings"}
          </button>
        ))}
      </nav>
    </div>
  );
}

function VaultList({
  items,
  onAdd,
}: {
  items: VaultItem[];
  onAdd: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-muted)] text-sm mb-4">
          No items in your vault yet
        </p>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Add your first password
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {item.type === "login" && "username" in item.fields
                ? item.fields.username
                : item.type}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(
                "password" in item.fields ? item.fields.password : "",
              );
            }}
            className="text-xs text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-text)] transition-all"
          >
            Copy
          </button>
        </div>
      ))}
    </div>
  );
}

function AddItem({ onDone }: { onDone: () => void }) {
  const { addItem } = useVault();
  const [type, setType] = useState<"login" | "card" | "note" | "identity">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: VaultItem = {
      id: crypto.randomUUID(),
      type,
      name,
      tags: [],
      folderId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields:
        type === "login"
          ? { username, password, uris: uri ? [uri] : undefined, notes: notes || undefined, previousPasswords: [] }
          : type === "card"
            ? { cardholder: username, number: password, expiryMonth: "", expiryYear: "", cvv: "", notes: notes || undefined }
            : type === "note"
              ? { content: notes || "" }
              : { notes: notes || undefined },
    };
    addItem(item);
    onDone();
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-lg font-semibold mb-4">Add Item</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          {(["login", "card", "note", "identity"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                type === t
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-surface-hover)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <input
          type="text"
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />

        {type === "login" && (
          <>
            <input
              type="url"
              placeholder="Website URL"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </>
        )}

        {(type === "card" || type === "identity") && (
          <>
            <input
              type="text"
              placeholder={type === "card" ? "Cardholder Name" : "Full Name"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
            {type === "card" && (
              <input
                type="text"
                placeholder="Card Number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
              />
            )}
          </>
        )}

        <textarea
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="flex-1 py-2 border border-[var(--color-border)] rounded text-sm hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name}
            className="flex-1 py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold">Settings</h2>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
        <h3 className="text-sm font-medium mb-2">Security</h3>
        <div className="space-y-2">
          <label className="flex items-center justify-between text-sm">
            <span>Auto-lock timeout</span>
            <select className="py-1 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-xs focus:outline-none">
              <option>5 minutes</option>
              <option>15 minutes</option>
              <option>1 hour</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Clipboard clear</span>
            <select className="py-1 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-xs focus:outline-none">
              <option>30 seconds</option>
              <option>60 seconds</option>
              <option>2 minutes</option>
            </select>
          </label>
        </div>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
        <h3 className="text-sm font-medium mb-2">Account</h3>
        <button className="text-sm text-[var(--color-danger)] hover:underline">
          Delete Account
        </button>
      </div>
    </div>
  );
}

import type { VaultItem } from "@ironlox/schemas";

export default function Home() {
  return (
    <Providers>
      <HomeContent />
    </Providers>
  );
}
