import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  createEmptyVault,
  generatePassword,
  generatePassphrase,
  addItemToVault,
  removeItemFromVault,
  updateItemInVault,
  generateTotp,
} from "@ironlox/crypto";
import type { Vault, VaultItem } from "@ironlox/schemas";
import { vaultSync } from "./sync";
import logoUrl from "data-url:~assets/logo.svg";
import "~style.css";

// ── App shell — owns only auth, vault, and view routing ──

function App() {
  const [locked, setLocked] = useState(true);
  const [vault, setVault] = useState<Vault>(createEmptyVault());
  const [vaultVersion, setVaultVersion] = useState(1);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [view, setView] = useState<"list" | "add" | "edit" | "generator" | "pin-setup">("list");
  const [recents, setRecents] = useState<VaultItem[]>([]);
  const [email, setEmail] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Init from chrome.storage
  useEffect(() => {
    chrome.storage.local.get(["ironlox_email"], (r) => {
      const stored = r as { ironlox_email?: string };
      if (stored.ironlox_email) setEmail(stored.ironlox_email);
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get({ ironlox_recents: [] }, (r: { ironlox_recents?: string[] }) => {
      if (r.ironlox_recents)
        setRecents(
          r.ironlox_recents
            .map((id) => vault.items.find((i) => i.id === id))
            .filter(Boolean) as VaultItem[],
        );
    });
  }, [vault]);

  // Keyboard shortcuts — always active, minimal deps
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !locked && view === "list" && !selectedItem) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (selectedItem) setSelectedItem(null);
        else if (view !== "list") setView("list");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, view, selectedItem]);

  const saveAndSync = useCallback(
    async (updated: Vault) => {
      setVault(updated);
      try {
        const newVersion = await vaultSync.push(updated, vaultVersion);
        setVaultVersion(newVersion);
        setLastSynced(Date.now());
        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    },
    [vaultVersion],
  );

  const copyAndClear = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    chrome.alarms.create("clear-clipboard", { delayInMinutes: 1 });
  }, []);

  const trackRecent = useCallback(async (itemId: string) => {
    const stored = await chrome.storage.local.get({ ironlox_recents: [] });
    const ids = (stored.ironlox_recents as string[]).filter((id) => id !== itemId);
    ids.unshift(itemId);
  }, []);

  const filteredItems = useMemo(() => {
    const active = vault.items.filter((i) => !i.deleted);
    return search
      ? active.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
      : active;
  }, [vault, search]);

  const handleLock = useCallback(() => {
    vaultSync.clearAuth();
    setLocked(true);
    setView("list");
    setSelectedItem(null);
  }, []);

  // ── View routing ──

  if (locked) {
    return (
      <LockedView
        email={email}
        setEmail={setEmail}
        setLocked={setLocked}
        setVault={setVault}
        setVaultVersion={setVaultVersion}
        setLastSynced={setLastSynced}
        setSyncStatus={setSyncStatus}
        onPinSetupRequest={() => setView("pin-setup")}
      />
    );
  }

  if (view === "pin-setup") {
    return <PinSetupView onDone={() => setView("list")} />;
  }

  if (view === "generator") {
    return <GeneratorView onBack={() => setView("list")} onCopy={copyAndClear} />;
  }

  if (view === "add") {
    return <AddItemView vault={vault} saveAndSync={saveAndSync} onDone={() => setView("list")} />;
  }

  if (view === "edit" && selectedItem) {
    return (
      <EditItemView
        item={selectedItem}
        vault={vault}
        saveAndSync={saveAndSync}
        onUpdated={(updated) => {
          setVault(updated.vault);
          setSelectedItem(updated.item);
        }}
        onDone={() => setView("list")}
      />
    );
  }

  if (selectedItem) {
    return (
      <ItemDetailView
        item={selectedItem}
        vault={vault}
        copyAndClear={copyAndClear}
        saveAndSync={saveAndSync}
        onBack={() => setSelectedItem(null)}
        onEdit={() => setView("edit")}
      />
    );
  }

  // ── Main list view ──

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white animate-popup-enter">
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <img src={logoUrl} alt="Ironlox" className="h-5 w-auto" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("generator")}
            className="text-xs text-gray-400 hover:text-white"
          >
            Generate
          </button>
          <button onClick={handleLock} className="text-gray-400 text-xs hover:text-white">
            Lock
          </button>
        </div>
      </div>
      <div className="p-2">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${filteredItems.length} items...`}
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-gray-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {!search && recents.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Recent</p>
            {recents.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  trackRecent(item.id);
                  setSelectedItem(item);
                }}
                className="w-full text-left px-3 py-1 hover:bg-gray-800 rounded text-sm mb-0.5 flex items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">{subtitle(item)}</p>
                </div>
              </button>
            ))}
            <div className="border-b border-gray-800 my-1" />
          </div>
        )}
        {filteredItems.length === 0 ? (
          <p className="text-gray-500 text-xs text-center mt-8">
            {vault.items.length === 0 ? "No passwords yet" : "No matches"}
          </p>
        ) : (
          filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                trackRecent(item.id);
                setSelectedItem(item);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded text-sm mb-0.5 flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.type === "login" && "username" in item.fields
                    ? String(item.fields.username ?? "")
                    : item.type}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
      <div className="p-2 border-t border-gray-800 space-y-1">
        {(lastSynced || syncStatus) && (
          <p className="text-center text-gray-600 text-[10px]">
            {syncStatus === "syncing"
              ? "Syncing..."
              : syncStatus === "offline"
                ? "Offline"
                : lastSynced
                  ? `Synced ${Math.round((Date.now() - lastSynced) / 1000)}s ago`
                  : ""}
          </p>
        )}
        <button
          onClick={() => setView("add")}
          className="w-full py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200"
        >
          + Add Item
        </button>
      </div>
    </div>
  );
}

// ── Sub-components with isolated state ──

function LockedView({
  email,
  setEmail,
  setLocked,
  setVault,
  setVaultVersion,
  setLastSynced,
  setSyncStatus,
  onPinSetupRequest,
}: {
  email: string;
  setEmail: (v: string) => void;
  setLocked: (v: boolean) => void;
  setVault: (v: Vault) => void;
  setVaultVersion: (v: number) => void;
  setLastSynced: (v: number | null) => void;
  setSyncStatus: (v: "synced" | "syncing" | "offline") => void;
  onPinSetupRequest: () => void;
}) {
  const [masterPassword, setMasterPassword] = useState("");
  const [pin, setPin] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    chrome.storage.local.get(["ironlox_pin_hash"], (r: { ironlox_pin_hash?: string }) => {
      if (r.ironlox_pin_hash) setHasPin(true);
    });
  }, []);

  const unlock = useCallback(async () => {
    if (!masterPassword || !email) return;
    setUnlocking(true);
    setError("");
    try {
      await vaultSync.login(masterPassword, email);
      const state = await vaultSync.pull();
      setVault(state.vault);
      setVaultVersion(state.version);
      setLastSynced(state.lastSynced);
      setSyncStatus("synced");
      setLocked(false);
    } catch {
      setError("Invalid email or master password");
    } finally {
      setUnlocking(false);
    }
  }, [masterPassword, email, setVault, setVaultVersion, setLastSynced, setSyncStatus, setLocked]);

  const pinUnlock = useCallback(async () => {
    if (!pin || pin.length < 4) return;
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
    const pinHash = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const stored = await chrome.storage.local.get(["ironlox_pin_hash", "ironlox_pin_vaultkey"]);
    if (stored.ironlox_pin_hash === pinHash && stored.ironlox_pin_vaultkey) {
      const keyData = JSON.parse(stored.ironlox_pin_vaultkey as string) as number[];
      await vaultSync.setAuth("", "", new Uint8Array(keyData), email ?? "");
      const state = (await vaultSync.loadOffline()) ?? (await vaultSync.pull());
      setVault(state.vault);
      setVaultVersion(state.version);
      setLastSynced(state.lastSynced);
      setLocked(false);
    } else {
      setError("Invalid PIN");
    }
  }, [pin, email, setVault, setVaultVersion, setLastSynced, setLocked]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 bg-gray-950 text-white animate-blur-in">
      <img src={logoUrl} alt="Ironlox" className="h-8 w-auto mb-4" />
      {hasPin && !usePin ? (
        <>
          <p className="text-sm text-gray-400 mb-4">Enter your PIN</p>
          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && pinUnlock()}
            placeholder="PIN"
            className="w-32 text-center text-lg px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-gray-500 tracking-widest"
            autoFocus
          />
          <button
            onClick={() => setUsePin(true)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-400"
          >
            Use master password instead
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">Enter your master password</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm mb-2 focus:outline-none focus:border-gray-500"
          />
          <input
            type="password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            placeholder="Master password"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-gray-500"
            autoFocus
          />
        </>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <button
        onClick={hasPin && !usePin ? pinUnlock : unlock}
        disabled={unlocking || (!masterPassword && !pin)}
        className="w-full mt-3 py-2 bg-white text-black rounded text-sm font-medium disabled:opacity-50"
      >
        {unlocking ? "Unlocking..." : "Unlock"}
      </button>
      {!hasPin && (
        <button
          onClick={onPinSetupRequest}
          className="mt-2 text-xs text-gray-500 hover:text-gray-400"
        >
          Set up PIN for quick unlock
        </button>
      )}
    </div>
  );
}

function PinSetupView({ onDone }: { onDone: () => void }) {
  const [setupPin, setSetupPin] = useState("");

  const save = useCallback(async () => {
    if (!setupPin || setupPin.length < 4) return;
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(setupPin));
    const pinHash = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const vk = vaultSync.getVaultKey();
    if (vk)
      await chrome.storage.local.set({
        ironlox_pin_hash: pinHash,
        ironlox_pin_vaultkey: JSON.stringify(Array.from(vk)),
      });
    onDone();
  }, [setupPin, onDone]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 bg-gray-950 text-white animate-slide-down">
      <p className="text-sm text-gray-400 mb-4">Set up a PIN for quick unlock</p>
      <input
        type="password"
        maxLength={6}
        value={setupPin}
        onChange={(e) => setSetupPin(e.target.value.slice(0, 6))}
        placeholder="4-6 digit PIN"
        className="w-40 text-center text-lg px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-gray-500 tracking-widest"
        autoFocus
      />
      <button
        onClick={save}
        disabled={setupPin.length < 4}
        className="w-40 mt-3 py-2 bg-white text-black rounded text-sm font-medium disabled:opacity-50"
      >
        Save PIN
      </button>
      <button onClick={onDone} className="mt-2 text-xs text-gray-500 hover:text-gray-400">
        Cancel
      </button>
    </div>
  );
}

function GeneratorView({ onBack, onCopy }: { onBack: () => void; onCopy: (t: string) => void }) {
  const [genType, setGenType] = useState<"random" | "passphrase">("random");
  const [genLength, setGenLength] = useState(20);
  const [genUppercase, setGenUppercase] = useState(true);
  const [genLowercase, setGenLowercase] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genWordCount, setGenWordCount] = useState(4);

  const [regenCounter, setRegenCounter] = useState(0);
  const generatedValue = useMemo(() => {
    if (genType === "random")
      return generatePassword({
        length: genLength,
        uppercase: genUppercase,
        lowercase: genLowercase,
        numbers: genNumbers,
        symbols: genSymbols,
      });
    return generatePassphrase({ wordCount: genWordCount, separator: "-" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    genType,
    genLength,
    genUppercase,
    genLowercase,
    genNumbers,
    genSymbols,
    genWordCount,
    regenCounter,
  ]);

  return (
    <div className="flex flex-col h-full p-4 bg-gray-950 text-white animate-slide-down">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-gray-400 text-sm hover:text-white">
          Back
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => setGenType("random")}
            className={`px-2 py-1 text-xs rounded ${genType === "random" ? "bg-gray-700" : "text-gray-500"}`}
          >
            Random
          </button>
          <button
            onClick={() => setGenType("passphrase")}
            className={`px-2 py-1 text-xs rounded ${genType === "passphrase" ? "bg-gray-700" : "text-gray-500"}`}
          >
            Passphrase
          </button>
        </div>
      </div>
      <div className="bg-gray-900 rounded p-3 mb-3">
        <p
          className="font-mono text-sm break-all cursor-pointer hover:text-gray-300"
          onClick={() => onCopy(generatedValue)}
        >
          {generatedValue}
        </p>
      </div>
      {genType === "random" ? (
        <div className="space-y-2 text-sm">
          <label className="flex items-center justify-between">
            Length: {genLength}
            <input
              type="range"
              min={8}
              max={128}
              value={genLength}
              onChange={(e) => setGenLength(Number(e.target.value))}
              className="w-24"
            />
          </label>
          {(["A-Z", "a-z", "0-9", "!@#$"] as const).map(([label], i) => (
            <label key={label} className="flex items-center justify-between text-sm">
              {label}
              <input
                type="checkbox"
                checked={[genUppercase, genLowercase, genNumbers, genSymbols][i]}
                onChange={(e) =>
                  [setGenUppercase, setGenLowercase, setGenNumbers, setGenSymbols][i]!(
                    e.target.checked,
                  )
                }
              />
            </label>
          ))}
        </div>
      ) : (
        <label className="flex items-center justify-between text-sm">
          Words: {genWordCount}
          <input
            type="range"
            min={3}
            max={10}
            value={genWordCount}
            onChange={(e) => setGenWordCount(Number(e.target.value))}
            className="w-24"
          />
        </label>
      )}
      <button
        onClick={() => setRegenCounter((n) => n + 1)}
        className="mt-4 w-full py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200"
      >
        Regenerate
      </button>
    </div>
  );
}

function AddItemView({
  vault,
  saveAndSync,
  onDone,
}: {
  vault: Vault;
  saveAndSync: (v: Vault) => Promise<void>;
  onDone: () => void;
}) {
  const [addType, setAddType] = useState<"login" | "card" | "note" | "identity">("login");
  const [addName, setAddName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addUri, setAddUri] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addCardholder, setAddCardholder] = useState("");
  const [addCardNumber, setAddCardNumber] = useState("");
  const [addExpiryMonth, setAddExpiryMonth] = useState("");
  const [addExpiryYear, setAddExpiryYear] = useState("");
  const [addCvv, setAddCvv] = useState("");
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmailField, setAddEmailField] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setAddName("");
    setAddUsername("");
    setAddPassword("");
    setAddUri("");
    setAddContent("");
    setAddCardholder("");
    setAddCardNumber("");
    setAddExpiryMonth("");
    setAddExpiryYear("");
    setAddCvv("");
    setAddFirstName("");
    setAddLastName("");
    setAddPhone("");
    setAddEmailField("");
  }, []);

  const handleAdd = useCallback(async () => {
    if (!addName) return;
    setSaving(true);
    let fields: Record<string, unknown> = {};
    if (addType === "login")
      fields = {
        username: addUsername,
        password: addPassword,
        uris: addUri ? [addUri] : undefined,
      };
    else if (addType === "card")
      fields = {
        cardholder: addCardholder,
        number: addCardNumber,
        expiryMonth: addExpiryMonth,
        expiryYear: addExpiryYear,
        cvv: addCvv,
      };
    else if (addType === "note") fields = { content: addContent };
    else if (addType === "identity")
      fields = {
        firstName: addFirstName,
        lastName: addLastName,
        email: addEmailField,
        phone: addPhone,
      };
    const item: VaultItem = {
      id: crypto.randomUUID(),
      type: addType,
      name: addName,
      tags: [],
      folderId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields,
    };
    const updated = addItemToVault(vault, item);
    await saveAndSync(updated);
    reset();
    onDone();
  }, [
    addName,
    addType,
    addUsername,
    addPassword,
    addUri,
    addContent,
    addCardholder,
    addCardNumber,
    addExpiryMonth,
    addExpiryYear,
    addCvv,
    addFirstName,
    addLastName,
    addPhone,
    addEmailField,
    vault,
    saveAndSync,
    reset,
    onDone,
  ]);

  return (
    <div className="flex flex-col h-full p-4 bg-gray-950 text-white animate-slide-down">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => {
            reset();
            onDone();
          }}
          className="text-gray-400 text-sm hover:text-white"
        >
          Back
        </button>
        {addType === "login" && (
          <button
            onClick={() => setAddPassword(generatePassword())}
            className="text-xs text-blue-400"
          >
            Use Generated
          </button>
        )}
      </div>
      <div className="flex gap-1 mb-3">
        {(["login", "card", "note", "identity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setAddType(t)}
            className={`flex-1 py-1 text-xs rounded ${addType === t ? "bg-gray-700 text-white" : "text-gray-500"}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <h2 className="text-lg font-semibold mb-3">
        Add {addType.charAt(0).toUpperCase() + addType.slice(1)}
      </h2>
      <div className="space-y-2">
        <input
          type="text"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder="Name"
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
        />
        {addType === "login" && (
          <>
            <input
              type="text"
              value={addUri}
              onChange={(e) => setAddUri(e.target.value)}
              placeholder="Website URL"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
            />
            <input
              type="text"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="Username"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
            />
            <input
              type="password"
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
            />
          </>
        )}
        {addType === "card" && (
          <>
            <input
              type="text"
              value={addCardholder}
              onChange={(e) => setAddCardholder(e.target.value)}
              placeholder="Cardholder Name"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
            />
            <input
              type="text"
              value={addCardNumber}
              onChange={(e) => setAddCardNumber(e.target.value)}
              placeholder="Card Number"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={addExpiryMonth}
                onChange={(e) => setAddExpiryMonth(e.target.value)}
                placeholder="MM"
                maxLength={2}
                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
              />
              <input
                type="text"
                value={addExpiryYear}
                onChange={(e) => setAddExpiryYear(e.target.value)}
                placeholder="YYYY"
                maxLength={4}
                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
              />
              <input
                type="password"
                value={addCvv}
                onChange={(e) => setAddCvv(e.target.value)}
                placeholder="CVV"
                maxLength={4}
                className="flex-[0.5] px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
              />
            </div>
          </>
        )}
        {addType === "note" && (
          <textarea
            value={addContent}
            onChange={(e) => setAddContent(e.target.value)}
            placeholder="Note content..."
            rows={4}
            className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none resize-none"
          />
        )}
        {addType === "identity" && (
          <>
            <input
              type="text"
              value={addFirstName}
              onChange={(e) => setAddFirstName(e.target.value)}
              placeholder="First Name"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
            />
            <input
              type="text"
              value={addLastName}
              onChange={(e) => setAddLastName(e.target.value)}
              placeholder="Last Name"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
            />
            <input
              type="email"
              value={addEmailField}
              onChange={(e) => setAddEmailField(e.target.value)}
              placeholder="Email"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
            />
            <input
              type="text"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              placeholder="Phone"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
            />
          </>
        )}
      </div>
      <button
        onClick={handleAdd}
        disabled={!addName || saving}
        className="mt-4 w-full py-2 bg-white text-black rounded text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

function EditItemView({
  item,
  vault,
  saveAndSync,
  onUpdated,
  onDone,
}: {
  item: VaultItem;
  vault: Vault;
  saveAndSync: (v: Vault) => Promise<void>;
  onUpdated: (result: { vault: Vault; item: VaultItem }) => void;
  onDone: () => void;
}) {
  const f = item.fields as Record<string, unknown>;
  const [editName, setEditName] = useState(item.name);
  const [editUsername, setEditUsername] = useState((f.username as string) ?? "");
  const [editPassword, setEditPassword] = useState((f.password as string) ?? "");
  const [editUri, setEditUri] = useState(((f.uris as string[]) ?? [])[0] ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!editName) return;
    setSaving(true);
    const updated = updateItemInVault(vault, item.id, {
      name: editName,
      fields: {
        ...f,
        username: editUsername,
        password: editPassword,
        uris: editUri ? [editUri] : undefined,
      },
      updatedAt: new Date().toISOString(),
    } as Partial<VaultItem>);
    await saveAndSync(updated);
    const updatedItem = updated.items.find((i) => i.id === item.id) ?? item;
    onUpdated({ vault: updated, item: updatedItem });
    onDone();
  }, [
    editName,
    editUsername,
    editPassword,
    editUri,
    item,
    vault,
    f,
    saveAndSync,
    onUpdated,
    onDone,
  ]);

  return (
    <div className="flex flex-col h-full p-4 bg-gray-950 text-white animate-slide-down">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onDone} className="text-gray-400 text-sm hover:text-white">
          Back
        </button>
      </div>
      <h2 className="text-lg font-semibold mb-3">Edit Login</h2>
      <div className="space-y-2">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Name"
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
        />
        <input
          type="text"
          value={editUri}
          onChange={(e) => setEditUri(e.target.value)}
          placeholder="Website URL"
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
        />
        <input
          type="text"
          value={editUsername}
          onChange={(e) => setEditUsername(e.target.value)}
          placeholder="Username"
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
        />
        <input
          type="password"
          value={editPassword}
          onChange={(e) => setEditPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={!editName || saving}
        className="mt-4 w-full py-2 bg-white text-black rounded text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

function ItemDetailView({
  item,
  vault,
  copyAndClear,
  saveAndSync,
  onBack,
  onEdit,
}: {
  item: VaultItem;
  vault: Vault;
  copyAndClear: (t: string) => void;
  saveAndSync: (v: Vault) => Promise<void>;
  onBack: () => void;
  onEdit: () => void;
}) {
  const f = item.fields as Record<string, unknown>;
  const [totpCode, setTotpCode] = useState("");
  const [totpRemaining, setTotpRemaining] = useState(30);

  // TOTP — only runs in this component
  useEffect(() => {
    if (!("totpSecret" in item.fields) || !item.fields.totpSecret) {
      setTotpCode("");
      return;
    }
    const secret = item.fields.totpSecret;
    let cancelled = false;
    async function refresh() {
      const code = await generateTotp(secret);
      if (!cancelled) {
        setTotpCode(code);
        setTotpRemaining(30 - (new Date().getSeconds() % 30));
      }
    }
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [item]);

  const handleAutofill = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "AUTOFILL",
        username: f.username ?? "",
        password: f.password ?? "",
        totp: totpCode || undefined,
      });
      window.close();
    }
  }, [f, totpCode]);

  const handleDelete = useCallback(async () => {
    const updated = removeItemFromVault(vault, item.id);
    await saveAndSync(updated);
    onBack();
  }, [item, vault, saveAndSync, onBack]);

  return (
    <div className="flex flex-col h-full p-4 bg-gray-950 text-white animate-slide-down">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="text-gray-400 text-sm hover:text-white">
          Back
        </button>
        <div className="flex gap-2">
          <button onClick={handleAutofill} className="text-xs text-blue-400 hover:text-blue-300">
            Autofill
          </button>
          <button onClick={onEdit} className="text-xs text-gray-400 hover:text-white">
            Edit
          </button>
          <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300">
            Delete
          </button>
        </div>
      </div>
      <h2 className="text-lg font-semibold mb-3">{item.name}</h2>
      <div className="space-y-3">
        {"username" in item.fields && (
          <FieldRow label="Username" value={String(f.username ?? "")} onCopy={copyAndClear} />
        )}
        {"password" in item.fields && (
          <FieldRow
            label="Password"
            value={String(f.password ?? "")}
            masked
            onCopy={copyAndClear}
          />
        )}
        {"cardholder" in item.fields && (
          <FieldRow label="Cardholder" value={String(f.cardholder ?? "")} onCopy={copyAndClear} />
        )}
        {"number" in item.fields && (
          <FieldRow
            label="Card Number"
            value={String(f.number ?? "")}
            masked
            onCopy={copyAndClear}
          />
        )}
        {item.type === "card" && f.expiryMonth ? (
          <div className="bg-gray-900 rounded p-2 flex justify-between">
            <p className="text-xs text-gray-500">Expiry</p>
            <p className="text-sm font-mono">
              {String(f.expiryMonth ?? "")}/{String(f.expiryYear ?? "")}
            </p>
          </div>
        ) : null}
        {"cvv" in item.fields && f.cvv ? (
          <FieldRow label="CVV" value={String(f.cvv ?? "")} masked onCopy={copyAndClear} />
        ) : null}
        {item.type === "identity" && (f.firstName || f.lastName) ? (
          <FieldRow
            label="Name"
            value={`${String(f.firstName ?? "")} ${String(f.lastName ?? "")}`.trim()}
            onCopy={copyAndClear}
          />
        ) : null}
        {item.type === "identity" && f.email ? (
          <FieldRow label="Email" value={String(f.email ?? "")} onCopy={copyAndClear} />
        ) : null}
        {item.type === "identity" && f.phone ? (
          <FieldRow label="Phone" value={String(f.phone ?? "")} onCopy={copyAndClear} />
        ) : null}
        {item.type === "note" && "content" in item.fields ? (
          <div className="bg-gray-900 rounded p-2">
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{String(f.content ?? "")}</p>
          </div>
        ) : null}
        {"totpSecret" in item.fields && f.totpSecret ? (
          <div className="bg-gray-900 rounded p-2">
            <p className="text-xs text-gray-500">2FA Code</p>
            <p className="text-lg font-mono tracking-widest">{totpCode || "------"}</p>
            <p className="text-[10px] text-gray-500">{totpRemaining}s</p>
            <button
              onClick={() => totpCode && copyAndClear(totpCode)}
              className="text-xs text-gray-500 hover:text-white mt-1"
            >
              Copy code
            </button>
          </div>
        ) : null}
        {"notes" in item.fields && f.notes ? (
          <div className="bg-gray-900 rounded p-2">
            <p className="text-xs text-gray-500">Notes</p>
            <p className="text-sm text-gray-300">{String(f.notes)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Shared helpers ──

function FieldRow({
  label,
  value,
  masked,
  onCopy,
}: {
  label: string;
  value: string;
  masked?: boolean;
  onCopy: (t: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between bg-gray-900 rounded p-2">
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-mono">{masked && !show ? "••••••••" : value}</p>
      </div>
      <div className="flex gap-1">
        {masked && (
          <button
            onClick={() => setShow(!show)}
            className="text-xs text-gray-500 hover:text-white px-1"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
        <button
          onClick={() => onCopy(value)}
          className="text-xs text-gray-500 hover:text-white px-2"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

function subtitle(item: VaultItem): string {
  if (item.type === "login" && "username" in item.fields) return String(item.fields.username ?? "");
  if (item.type === "card" && "number" in item.fields)
    return `••••${String(item.fields.number ?? "").slice(-4)}`;
  if (item.type === "identity" && "email" in item.fields && item.fields.email)
    return String(item.fields.email);
  return item.type;
}

export default App;
