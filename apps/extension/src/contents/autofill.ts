// Ironlox — Content Script

import { detectLoginForm } from "@ironlox/autofill";
import type { DetectedForm } from "@ironlox/autofill";

interface AutofillMessage {
  type: "DETECT_FORMS" | "AUTOFILL";
  username?: string;
  password?: string;
  totp?: string;
}

chrome.runtime.onMessage.addListener(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (message: AutofillMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
  if (message.type === "DETECT_FORMS") {
    const forms = detectLoginForm();
    sendResponse({ forms: serializeForms(forms) });
  }

  if (message.type === "AUTOFILL") {
    const { username, password, totp } = message;
    const forms = detectLoginForm();

    if (forms.length > 0) {
      const form = forms[0]!;
      fillForm(form, username ?? "", password ?? "", totp);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No login form detected" });
    }
  }

  return true;
});

function fillForm(form: DetectedForm, username: string, password: string, totp?: string): void {
  const fields = form.fields;

  for (const field of fields) {
    const el = field.element as HTMLInputElement;

    if (field.type === "username" && username) {
      setNativeValue(el, username);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (field.type === "password" && password) {
      setNativeValue(el, password);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (field.type === "submit") {
      if (totp) {
        const totpInput = findTotpField();
        if (totpInput) {
          setNativeValue(totpInput, totp);
          totpInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    }
  }
}

function findTotpField(): HTMLInputElement | null {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input:not([type="password"]):not([type="submit"]):not([type="hidden"])',
  );

  for (const input of inputs) {
    const attrs = [
      input.name?.toLowerCase() ?? "",
      input.id?.toLowerCase() ?? "",
      input.placeholder?.toLowerCase() ?? "",
      input.autocomplete?.toLowerCase() ?? "",
    ].join(" ");

    if (
      attrs.includes("2fa") ||
      attrs.includes("totp") ||
      attrs.includes("authenticator") ||
      attrs.includes("code") ||
      attrs.includes("token") ||
      attrs.includes("otp") ||
      attrs.includes("verification") ||
      attrs.includes("mfa")
    ) {
      return input;
    }
  }

  return null;
}

function setNativeValue(el: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  if (nativeSetter?.set) {
    nativeSetter.set.call(el, value);
  } else {
    el.value = value;
  }
}

function serializeForms(
  forms: DetectedForm[],
): Array<{ confidence: number; fields: Array<{ type: string; name: string | undefined }> }> {
  return forms.map((f) => ({
    confidence: f.confidence,
    fields: f.fields.map((field) => ({
      type: field.type,
      name: field.name ?? undefined,
    })),
  }));
}

export {};
