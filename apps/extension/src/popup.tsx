import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createEmptyVault, generatePassword, generatePassphrase, addItemToVault, removeItemFromVault } from "@ironlox/crypto";
import { generateTotp } from "@ironlox/crypto";
import type { Vault, VaultItem } from "@ironlox/schemas";
import { vaultSync } from "./sync";
import logoUrl from "data-url:~assets/logo.svg";

function App() {
  const [locked, setLocked] = useState(true);
  const [masterPassword, setMasterPassword] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [vault, setVault] = useState<Vault>(createEmptyVault());
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [vaultVersion, setVaultVersion] = useState(1);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpRemaining, setTotpRemaining] = useState(30);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");

  const [genType, setGenType] = useState<"random" | "passphrase">("random");
  const [genLength, setGenLength] = useState(20);
  const [genUppercase, setGenUppercase] = useState(true);
  const [genLowercase, setGenLowercase] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genWordCount, setGenWordCount] = useState(4);
  const [generatedValue, setGeneratedValue] = useState("");

  // Add item state
  const [addName, setAddName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addUri, setAddUri] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { chrome.storage.local.get(["ironlox_email"], (r: { ironlox_email?: string }) => { if (r.ironlox_email) setEmail(r.ironlox_email); }); }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !locked && !showGenerator && !showAddItem && !selectedItem) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (showGenerator) setShowGenerator(false);
        else if (showAddItem) setShowAddItem(false);
        else if (selectedItem) setSelectedItem(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [locked, showGenerator, showAddItem, selectedItem]);

  const regen = useCallback(() => {
    if (genType === "random") setGeneratedValue(generatePassword({ length: genLength, uppercase: genUppercase, lowercase: genLowercase, numbers: genNumbers, symbols: genSymbols }));
    else setGeneratedValue(generatePassphrase({ wordCount: genWordCount, separator: "-" }));
  }, [genType, genLength, genUppercase, genLowercase, genNumbers, genSymbols, genWordCount]);

  useEffect(() => { regen(); }, [regen]);

  useEffect(() => {
    if (!selectedItem || !("totpSecret" in selectedItem.fields) || !selectedItem.fields.totpSecret) { setTotpCode(""); return; }
    const secret = selectedItem.fields.totpSecret;
    let cancelled = false;
    async function refresh() { const code = await generateTotp(secret); if (cancelled) return; setTotpCode(code); setTotpRemaining(30 - (new Date().getSeconds() % 30)); }
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedItem]);

  const saveAndSync = useCallback(async (updated: Vault) => {
    setVault(updated);
    try {
      const newVersion = await vaultSync.push(updated, vaultVersion);
      setVaultVersion(newVersion);
      setLastSynced(Date.now());
      setSyncStatus("synced");
    } catch { setSyncStatus("offline"); }
  }, [vaultVersion]);

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
    } finally { setUnlocking(false); }
  }, [masterPassword, email]);

  const handleAutofill = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && selectedItem) {
      const f = selectedItem.fields as Record<string, unknown>;
      chrome.tabs.sendMessage(tab.id, { type: "AUTOFILL", username: f.username ?? "", password: f.password ?? "", totp: totpCode || undefined });
      window.close();
    }
  }, [selectedItem, totpCode]);

  const handleAddItem = useCallback(async () => {
    if (!addName) return;
    const item: VaultItem = { id: crypto.randomUUID(), type: "login", name: addName, tags: [], folderId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fields: { username: addUsername, password: addPassword, uris: addUri ? [addUri] : undefined } };
    const updated = addItemToVault(vault, item);
    await saveAndSync(updated);
    setAddName(""); setAddUsername(""); setAddPassword(""); setAddUri("");
    setShowAddItem(false);
  }, [addName, addUsername, addPassword, addUri, vault, saveAndSync]);

  const handleDeleteItem = useCallback(async () => {
    if (!selectedItem) return;
    const updated = removeItemFromVault(vault, selectedItem.id);
    await saveAndSync(updated);
    setSelectedItem(null);
  }, [selectedItem, vault, saveAndSync]);

  const copyAndClear = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    chrome.alarms.create("clear-clipboard", { delayInMinutes: 1 });
  }, []);

  const filteredItems = useMemo(() => {
    const active = vault.items.filter((i) => !i.deleted);
    return search ? active.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())) : active;
  }, [vault, search]);

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 bg-gray-950 text-white">
        <img src={logoUrl} alt="Ironlox" className="h-8 w-auto mb-4" />
        {usePin ? (
          <>
            <p className="text-sm text-gray-400 mb-4">Enter your PIN</p>
            <input type="password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && unlock()} placeholder="PIN" className="w-32 text-center text-lg px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-gray-500 tracking-widest" autoFocus />
            <button onClick={() => setUsePin(false)} className="mt-2 text-xs text-gray-500 hover:text-gray-400">Use master password instead</button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">Enter your master password</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm mb-2 focus:outline-none focus:border-gray-500" />
            <input type="password" value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} placeholder="Master password" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-gray-500" autoFocus />
          </>
        )}
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <button onClick={unlock} disabled={unlocking || (!masterPassword && !pin)} className="w-full mt-3 py-2 bg-white text-black rounded text-sm font-medium disabled:opacity-50">
          {unlocking ? "Unlocking..." : "Unlock"}
        </button>
      </div>
    );
  }

  if (showGenerator) {
    return (
      <div className="flex flex-col h-full p-4 bg-gray-950 text-white">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setShowGenerator(false)} className="text-gray-400 text-sm hover:text-white">Back</button>
          <div className="flex gap-1">
            <button onClick={() => setGenType("random")} className={`px-2 py-1 text-xs rounded ${genType === "random" ? "bg-gray-700" : "text-gray-500"}`}>Random</button>
            <button onClick={() => setGenType("passphrase")} className={`px-2 py-1 text-xs rounded ${genType === "passphrase" ? "bg-gray-700" : "text-gray-500"}`}>Passphrase</button>
          </div>
        </div>
        <div className="bg-gray-900 rounded p-3 mb-3"><p className="font-mono text-sm break-all cursor-pointer hover:text-gray-300" onClick={() => copyAndClear(generatedValue)}>{generatedValue}</p></div>
        {genType === "random" ? (
          <div className="space-y-2 text-sm">
            <label className="flex items-center justify-between">Length: {genLength}<input type="range" min={8} max={128} value={genLength} onChange={(e) => setGenLength(Number(e.target.value))} className="w-24" /></label>
            {(["A-Z", "a-z", "0-9", "!@#$"] as const).map(([label], i) => (
              <label key={label} className="flex items-center justify-between text-sm">
                {label}<input type="checkbox" checked={[genUppercase, genLowercase, genNumbers, genSymbols][i]} onChange={(e) => [setGenUppercase, setGenLowercase, setGenNumbers, setGenSymbols][i]!(e.target.checked)} />
              </label>
            ))}
          </div>
        ) : (
          <label className="flex items-center justify-between text-sm">Words: {genWordCount}<input type="range" min={3} max={10} value={genWordCount} onChange={(e) => setGenWordCount(Number(e.target.value))} className="w-24" /></label>
        )}
        <button onClick={regen} className="mt-4 w-full py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200">Regenerate</button>
      </div>
    );
  }

  if (showAddItem) {
    return (
      <div className="flex flex-col h-full p-4 bg-gray-950 text-white">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setShowAddItem(false)} className="text-gray-400 text-sm hover:text-white">Back</button>
          <button onClick={() => { setAddPassword(generatedValue || generatePassword()); }} className="text-xs text-blue-400">Use Generated</button>
        </div>
        <h2 className="text-lg font-semibold mb-3">Add Login</h2>
        <div className="space-y-2">
          <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name" className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none" />
          <input type="text" value={addUri} onChange={(e) => setAddUri(e.target.value)} placeholder="Website URL" className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none" />
          <input type="text" value={addUsername} onChange={(e) => setAddUsername(e.target.value)} placeholder="Username" className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none" />
          <input type="password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none" />
        </div>
        <button onClick={handleAddItem} disabled={!addName} className="mt-4 w-full py-2 bg-white text-black rounded text-sm font-medium disabled:opacity-50">Save</button>
      </div>
    );
  }

  if (selectedItem) {
    const f = selectedItem.fields as Record<string, unknown>;
    return (
      <div className="flex flex-col h-full p-4 bg-gray-950 text-white">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setSelectedItem(null)} className="text-gray-400 text-sm hover:text-white">Back</button>
          <div className="flex gap-2">
            <button onClick={handleAutofill} className="text-xs text-blue-400 hover:text-blue-300">Autofill</button>
            <button onClick={handleDeleteItem} className="text-xs text-red-400 hover:text-red-300">Delete</button>
          </div>
        </div>
        <h2 className="text-lg font-semibold mb-3">{selectedItem.name}</h2>
        <div className="space-y-3">
          {"username" in selectedItem.fields && <FieldRow label="Username" value={String(f.username ?? "")} onCopy={copyAndClear} />}
          {"password" in selectedItem.fields && <FieldRow label="Password" value={String(f.password ?? "")} masked onCopy={copyAndClear} />}
          {"totpSecret" in selectedItem.fields && f.totpSecret ? (
            <div className="bg-gray-900 rounded p-2">
              <p className="text-xs text-gray-500">2FA Code</p>
              <p className="text-lg font-mono tracking-widest">{totpCode || "------"}</p>
              <p className="text-[10px] text-gray-500">{totpRemaining}s</p>
              <button onClick={() => totpCode && copyAndClear(totpCode)} className="text-xs text-gray-500 hover:text-white mt-1">Copy code</button>
            </div>
          ) : null}
          {"notes" in selectedItem.fields && f.notes ? <div className="bg-gray-900 rounded p-2"><p className="text-xs text-gray-500">Notes</p><p className="text-sm text-gray-300">{String(f.notes)}</p></div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <img src={logoUrl} alt="Ironlox" className="h-5 w-auto" />
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGenerator(true)} className="text-xs text-gray-400 hover:text-white">Generate</button>
          <button onClick={() => setLocked(true)} className="text-gray-400 text-xs hover:text-white">Lock</button>
        </div>
      </div>
      <div className="p-2">
        <input ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${filteredItems.length} items...`} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-gray-500" />
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {filteredItems.length === 0 ? (
          <p className="text-gray-500 text-xs text-center mt-8">{vault.items.length === 0 ? "No passwords yet" : "No matches"}</p>
        ) : (
          filteredItems.map((item) => (
            <button key={item.id} onClick={() => setSelectedItem(item)} className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded text-sm mb-0.5 flex items-center gap-2">
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{item.name}</p><p className="text-xs text-gray-500">{item.type === "login" && "username" in item.fields ? String(item.fields.username ?? "") : item.type}</p></div>
            </button>
          ))
        )}
      </div>
      <div className="p-2 border-t border-gray-800 space-y-1">
        {(lastSynced || syncStatus) && (
          <p className="text-center text-gray-600 text-[10px]">
            {syncStatus === "syncing" ? "Syncing..." : syncStatus === "offline" ? "Offline" : lastSynced ? `Synced ${Math.round((Date.now() - lastSynced) / 1000)}s ago` : ""}
          </p>
        )}
        <button onClick={() => setShowAddItem(true)} className="w-full py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200">+ Add Item</button>
      </div>
    </div>
  );
}

function FieldRow({ label, value, masked, onCopy }: { label: string; value: string; masked?: boolean; onCopy: (t: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between bg-gray-900 rounded p-2">
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-mono">{masked && !show ? "••••••••" : value}</p>
      </div>
      <div className="flex gap-1">
        {masked && <button onClick={() => setShow(!show)} className="text-xs text-gray-500 hover:text-white px-1">{show ? "Hide" : "Show"}</button>}
        <button onClick={() => onCopy(value)} className="text-xs text-gray-500 hover:text-white px-2">Copy</button>
      </div>
    </div>
  );
}

export default App;
