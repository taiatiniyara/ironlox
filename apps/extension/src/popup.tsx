import { useState, useEffect, useCallback } from "react";

import { createEmptyVault, generatePassword, generatePassphrase } from "@ironlox/crypto";
import type { Vault, VaultItem } from "@ironlox/schemas";
import { vaultSync } from "./sync";

function App() {
  const [locked, setLocked] = useState(true);
  const [masterPassword, setMasterPassword] = useState("");
  const [pin, setPin] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [vault, setVault] = useState<Vault>(createEmptyVault());
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [, setVaultVersion] = useState(1);
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  // Generate password state
  const [genType, setGenType] = useState<"random" | "passphrase">("random");
  const [genLength, setGenLength] = useState(20);
  const [genUppercase, setGenUppercase] = useState(true);
  const [genLowercase, setGenLowercase] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genWordCount, setGenWordCount] = useState(4);
  const [generatedValue, setGeneratedValue] = useState("");

  const regen = useCallback(() => {
    if (genType === "random") {
      setGeneratedValue(
        generatePassword({
          length: genLength,
          uppercase: genUppercase,
          lowercase: genLowercase,
          numbers: genNumbers,
          symbols: genSymbols,
        }),
      );
    } else {
      setGeneratedValue(generatePassphrase({ wordCount: genWordCount, separator: "-" }));
    }
  }, [genType, genLength, genUppercase, genLowercase, genNumbers, genSymbols, genWordCount]);

  useEffect(() => {
    regen();
  }, [regen]);

  const unlock = useCallback(async () => {
    if (!masterPassword) return;
    setUnlocking(true);
    setError("");

    try {
      // Try to load from offline cache first
      const cached = await vaultSync.loadOffline();
      if (cached) {
        setVault(cached.vault);
        setVaultVersion(cached.version);
        setLastSynced(cached.lastSynced);
      }
      setLocked(false);
    } catch {
      setError("Invalid master password");
    } finally {
      setUnlocking(false);
    }
  }, [masterPassword]);

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setTimeout(() => navigator.clipboard.writeText(""), 60_000);
  }, []);

  const handleAutofill = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "AUTOFILL",
        username: selectedItem && "username" in selectedItem.fields ? selectedItem.fields.username : "",
        password: selectedItem && "password" in selectedItem.fields ? selectedItem.fields.password : "",
      });
    }
  }, [selectedItem]);

  const filteredItems = search
    ? vault.items.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) &&
          !item.deleted,
      )
    : vault.items.filter((item) => !item.deleted);

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 bg-gray-950 text-white">
        <h1 className="text-xl font-bold mb-4">Ironlox</h1>
        {usePin ? (
          <>
            <p className="text-sm text-gray-400 mb-4">Enter your PIN</p>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              placeholder="PIN"
              className="w-32 text-center text-lg px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-gray-500 tracking-widest"
              autoFocus
            />
            <button
              onClick={() => setUsePin(false)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-400"
            >
              Use master password instead
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">Enter your master password</p>
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
          onClick={unlock}
          disabled={unlocking || (!masterPassword && !pin)}
          className="w-full mt-3 py-2 bg-white text-black rounded text-sm font-medium disabled:opacity-50"
        >
          {unlocking ? "Unlocking..." : "Unlock"}
        </button>
      </div>
    );
  }

  if (showGenerator) {
    return (
      <div className="flex flex-col h-full p-4 bg-gray-950 text-white">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setShowGenerator(false)} className="text-gray-400 text-sm hover:text-white">
            ← Back
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
            onClick={() => handleCopy(generatedValue)}
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
            {([
              ["A-Z", genUppercase, setGenUppercase],
              ["a-z", genLowercase, setGenLowercase],
              ["0-9", genNumbers, setGenNumbers],
              ["!@#$", genSymbols, setGenSymbols],
            ] as const).map(([label, val, set]) => (
              <label key={label} className="flex items-center justify-between text-sm">
                {label}
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => set(e.target.checked)}
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
          onClick={regen}
          className="mt-4 w-full py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200"
        >
          Regenerate
        </button>
      </div>
    );
  }

  if (selectedItem) {
    const fields = selectedItem.fields;
    return (
      <div className="flex flex-col h-full p-4 bg-gray-950 text-white">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setSelectedItem(null)} className="text-gray-400 text-sm hover:text-white">
            ← Back
          </button>
          <div className="flex gap-2">
            <button onClick={handleAutofill} className="text-xs text-blue-400 hover:text-blue-300">
              Autofill
            </button>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-3">{selectedItem.name}</h2>

        <div className="space-y-3">
          {"username" in fields && (
            <div className="flex items-center justify-between bg-gray-900 rounded p-2">
              <div>
                <p className="text-xs text-gray-500">Username</p>
                <p className="text-sm font-mono">{fields.username}</p>
              </div>
              <button
                onClick={() => handleCopy(fields.username)}
                className="text-xs text-gray-500 hover:text-white px-2"
              >
                Copy
              </button>
            </div>
          )}

          {"password" in fields && (
            <div className="flex items-center justify-between bg-gray-900 rounded p-2">
              <div>
                <p className="text-xs text-gray-500">Password</p>
                <p className="text-sm font-mono">••••••••</p>
              </div>
              <button
                onClick={() => handleCopy(fields.password)}
                className="text-xs text-gray-500 hover:text-white px-2"
              >
                Copy
              </button>
            </div>
          )}

          {"totpSecret" in fields && fields.totpSecret && (
            <div className="bg-gray-900 rounded p-2">
              <p className="text-xs text-gray-500">2FA Code</p>
              <p className="text-lg font-mono tracking-widest">------</p>
              <p className="text-xs text-gray-500 mt-1">Copy code</p>
            </div>
          )}

          {"notes" in fields && fields.notes && (
            <div className="bg-gray-900 rounded p-2">
              <p className="text-xs text-gray-500">Notes</p>
              <p className="text-sm text-gray-300">{fields.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-sm font-bold">Ironlox</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerator(true)}
            className="text-xs text-gray-400 hover:text-white"
          >
            Generate
          </button>
          <button
            onClick={() => setLocked(true)}
            className="text-gray-400 text-xs hover:text-white"
          >
            Lock
          </button>
        </div>
      </div>

      <div className="p-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${filteredItems.length} items...`}
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-gray-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {filteredItems.length === 0 ? (
          <p className="text-gray-500 text-xs text-center mt-8">
            {vault.items.length === 0 ? "No passwords yet" : "No matches"}
          </p>
        ) : (
          filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded text-sm mb-0.5 flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.type === "login" && "username" in item.fields
                    ? item.fields.username
                    : item.type}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {lastSynced && (
        <p className="text-center text-gray-600 text-[10px] pb-1">
          Synced {Math.round((Date.now() - lastSynced) / 1000)}s ago
        </p>
      )}

      <div className="p-2 border-t border-gray-800">
        <button
          onClick={() => {}}
          className="w-full py-2 bg-white text-black rounded text-sm font-medium hover:bg-gray-200"
        >
          + Add Item
        </button>
      </div>
    </div>
  );
}

export default App;
