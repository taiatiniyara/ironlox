import { detectLoginForm } from "@ironlox/autofill";
import type { DetectedForm } from "@ironlox/autofill";

interface AutofillMessage {
  type: "DETECT_FORMS" | "AUTOFILL" | "SHOW_SUGGESTION";
  username?: string;
  password?: string;
  totp?: string;
  items?: Array<{ name: string; username: string; password: string }>;
}

interface VaultSuggestion {
  name: string;
  username: string;
  password: string;
}

let suggestionBox: HTMLDivElement | null = null;
let detectTimeout: ReturnType<typeof setTimeout>;
let domObserver: MutationObserver | null = null;
let domObserverRan = false;

function initDomObserver() {
  if (domObserverRan) return;
  domObserverRan = true;
  if (domObserver) domObserver.disconnect();
  domObserver = new MutationObserver(() => {
    clearTimeout(detectTimeout);
    detectTimeout = setTimeout(initAutoSuggest, 500);
  });
  domObserver.observe(document.body, { childList: true, subtree: true });
}

function removeSuggestion() {
  if (suggestionBox) { suggestionBox.remove(); suggestionBox = null; }
}

function showInlineSuggestion(items: VaultSuggestion[], field: HTMLInputElement) {
  removeSuggestion();
  if (items.length === 0) return;

  const rect = field.getBoundingClientRect();
  const box = document.createElement("div");
  box.id = "ironlox-suggest";
  box.style.cssText = `
    position: absolute; z-index: 2147483647; background: #1a1a2e; border: 1px solid #333;
    border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); min-width: 220px;
    top: ${rect.bottom + window.scrollY + 4}px; left: ${rect.left + window.scrollX}px;
    font-family: system-ui, sans-serif; font-size: 13px; color: #e5e5e5; overflow: hidden;
  `;

  const header = document.createElement("div");
  header.style.cssText = "padding:6px 10px; font-size:11px; color:#666; border-bottom:1px solid #333;";
  header.textContent = `Ironlox — ${items.length} login${items.length > 1 ? "s" : ""} for this site`;
  box.appendChild(header);

  for (const item of items) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; align-items:center; padding:6px 10px; cursor:pointer; transition:background 0.1s;";
    row.onmouseenter = () => { row.style.background = "#222244"; };
    row.onmouseleave = () => { row.style.background = ""; };
    row.onclick = () => {
      const forms = detectLoginForm();
      if (forms.length > 0) fillForm(forms[0]!, item.username, item.password);
      removeSuggestion();
    };
    const icon = document.createElement("span");
    icon.style.cssText = "margin-right:8px; font-size:14px;";
    icon.textContent = "🔑";
    const text = document.createElement("div");
    text.style.cssText = "flex:1; min-width:0;";
    text.innerHTML = `<div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.name)}</div><div style="font-size:11px;color:#888">${escapeHtml(item.username)}</div>`;
    row.appendChild(icon);
    row.appendChild(text);
    box.appendChild(row);
  }

  document.body.appendChild(box);
  suggestionBox = box;

  const dismiss = (e: MouseEvent) => {
    if (!box.contains(e.target as Node)) { removeSuggestion(); document.removeEventListener("click", dismiss); }
  };
  setTimeout(() => document.addEventListener("click", dismiss), 0);
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

chrome.runtime.onMessage.addListener(
  (message: AutofillMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
  if (message.type === "DETECT_FORMS") {
    const forms = detectLoginForm();
    sendResponse({ forms: serializeForms(forms) });
  }

  if (message.type === "AUTOFILL") {
    const { username, password, totp } = message;
    const forms = detectLoginForm();
    if (forms.length > 0) {
      fillForm(forms[0]!, username ?? "", password ?? "", totp);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No login form detected" });
    }
  }

  if (message.type === "SHOW_SUGGESTION" && message.items) {
    const forms = detectLoginForm();
    if (forms.length > 0) {
      const usernameField = forms[0]!.fields.find((f) => f.type === "username");
      if (usernameField) showInlineSuggestion(message.items, usernameField.element as HTMLInputElement);
    }
    sendResponse({ success: true });
  }

  return true;
});

// Auto-detect forms on page load and request suggestions
function initAutoSuggest() {
  const forms = detectLoginForm();
  if (forms.length === 0) return;
  const url = window.location.href;
  chrome.runtime.sendMessage({ type: "GET_MATCHES", url }).then((resp: unknown) => {
    const items = (resp as { matches?: VaultSuggestion[] })?.matches;
    if (items && items.length > 0) {
      const usernameField = forms[0]!.fields.find((f) => f.type === "username");
      if (usernameField) showInlineSuggestion(items, usernameField.element as HTMLInputElement);
    }
  }).catch(() => {});
}

// Re-detect on DOM mutations (SPA navigation)
initDomObserver();
setTimeout(initAutoSuggest, 1000);

function fillForm(form: DetectedForm, username: string, password: string, totp?: string): void {
  for (const field of form.fields) {
    const el = field.element as HTMLInputElement;
    if (field.type === "username" && username) { setNativeValue(el, username); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
    if (field.type === "password" && password) { setNativeValue(el, password); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
    if (field.type === "submit" && totp) {
      const totpInput = findTotpField();
      if (totpInput) { setNativeValue(totpInput, totp); totpInput.dispatchEvent(new Event("input", { bubbles: true })); }
    }
  }
}

function findTotpField(): HTMLInputElement | null {
  const inputs = document.querySelectorAll<HTMLInputElement>('input:not([type="password"]):not([type="submit"]):not([type="hidden"])');
  for (const input of inputs) {
    const attrs = [input.name?.toLowerCase() ?? "", input.id?.toLowerCase() ?? "", input.placeholder?.toLowerCase() ?? "", input.autocomplete?.toLowerCase() ?? ""].join(" ");
    if (attrs.includes("2fa") || attrs.includes("totp") || attrs.includes("authenticator") || attrs.includes("code") || attrs.includes("token") || attrs.includes("otp") || attrs.includes("verification") || attrs.includes("mfa")) return input;
  }
  return null;
}

function setNativeValue(el: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (nativeSetter?.set) nativeSetter.set.call(el, value);
  else el.value = value;
}

function serializeForms(forms: DetectedForm[]): Array<{ confidence: number; fields: Array<{ type: string; name: string | undefined }> }> {
  return forms.map((f) => ({ confidence: f.confidence, fields: f.fields.map((field) => ({ type: field.type, name: field.name ?? undefined })) }));
}

export {};
