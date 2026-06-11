import { vaultSync } from "./sync";

const LOCK_TIMEOUT_MINUTES = 5;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("auto-lock", { delayInMinutes: LOCK_TIMEOUT_MINUTES, periodInMinutes: LOCK_TIMEOUT_MINUTES });
  chrome.alarms.create("token-refresh", { periodInMinutes: 10 });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "copy-password" || command === "copy-username") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const cached = await vaultSync.loadOffline();
    if (!cached) return;
    const active = cached.vault.items.filter((i) => !i.deleted && i.type === "login");
    if (active.length === 0) return;
    const tabUrl = tab.url ?? "";
    const match = active.find((item) => {
      const f = item.fields as Record<string, unknown>;
      const uris = (f.uris as string[]) ?? [];
      return uris.some((uri) => tabUrl.startsWith(uri));
    }) ?? active[0]!;
    const f = match.fields as Record<string, unknown>;
    const text = command === "copy-password" ? (f.password as string) : (f.username as string);
    if (text) {
      await navigator.clipboard.writeText(text);
      chrome.alarms.create("clear-clipboard", { delayInMinutes: 1 });
    }
  }
  if (command === "lock-vault") {
    vaultSync.clearAuth();
    chrome.storage.local.set({ ironlox_locked: true });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "clear-clipboard") {
    try {
      await navigator.clipboard.writeText("");
    } catch { /* clipboard may not be accessible */ }
  }
  if (alarm.name === "auto-lock") {
    vaultSync.clearAuth();
    chrome.storage.local.set({ ironlox_locked: true });
  }
  if (alarm.name === "token-refresh") {
    try {
      const { ironlox_access, ironlox_refresh } = await chrome.storage.local.get(["ironlox_access", "ironlox_refresh"]);
      if (ironlox_access && ironlox_refresh) {
        // Tokens are refreshed automatically via apiClient.onTokenRefresh callback
      }
    } catch { /* refresh failed, user must re-login */ }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUTOFILL") {
    sendResponse({ success: true });
  }
  return true;
});

chrome.idle.onStateChanged.addListener((state) => {
  if (state === "locked" || state === "idle") {
    vaultSync.clearAuth();
    chrome.storage.local.set({ ironlox_locked: true });
  }
});

export {};
