import type { DetectedForm, DetectedField } from "./types.js";

const PASSWORD_SELECTOR = 'input[type="password"]';

/**
 * Detect login forms on the current page.
 * Heuristic-based: finds password fields, walks DOM backward
 * to infer associated username fields.
 *
 * @returns array of detected forms with field mappings
 */
export function detectLoginForm(): DetectedForm[] {
  const forms: DetectedForm[] = [];

  const passwordInputs = document.querySelectorAll<HTMLInputElement>(PASSWORD_SELECTOR);

  for (const passwordInput of passwordInputs) {
    const fields: DetectedField[] = [];

    // Find the enclosing form
    const form = passwordInput.closest("form");
    const searchRoot = form ?? document;

    // Find username field by walking backward in DOM from password field
    const previousInputs = searchRoot.querySelectorAll<HTMLInputElement>(
      'input:not([type="password"]):not([type="submit"]):not([type="button"]):not([type="hidden"])',
    );

    let usernameField: HTMLInputElement | null = null;
    let highestConfidence = 0;

    for (const input of previousInputs) {
      const confidence = scoreUsernameField(input);
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        usernameField = input;
      }
    }

    if (usernameField) {
      fields.push({
        element: usernameField,
        type: "username",
        name: usernameField.name,
        id: usernameField.id,
        placeholder: usernameField.placeholder,
        autocomplete: usernameField.autocomplete,
        confidence: highestConfidence,
      });
    }

    fields.push({
      element: passwordInput,
      type: "password",
      name: passwordInput.name,
      id: passwordInput.id,
      placeholder: passwordInput.placeholder,
      autocomplete: passwordInput.autocomplete,
      confidence: 1,
    });

    // Find submit button
    const submitButton = searchRoot.querySelector<HTMLElement>(
      'button[type="submit"], input[type="submit"]',
    );
    if (submitButton) {
      fields.push({
        element: submitButton,
        type: "submit",
        confidence: 0.9,
      });
    }

    const confidence = fields.length >= 2 ? 0.85 : 0.5;
    forms.push({
      element: form as HTMLFormElement,
      fields,
      confidence,
    });
  }

  return forms;
}

/**
 * Detect input fields in a container element.
 * Used when the form is not a standard <form> element.
 */
export function detectFields(container: HTMLElement): DetectedField[] {
  const fields: DetectedField[] = [];

  container.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    const type = input.type.toLowerCase();

    if (type === "password") {
      fields.push({ element: input, type: "password", confidence: 1 });
    } else if (type === "email") {
      fields.push({ element: input, type: "email", confidence: 1 });
    } else if (type === "text" || type === "tel" || type === "") {
      const score = scoreUsernameField(input);
      if (score > 0.3) {
        fields.push({ element: input, type: "username", confidence: score });
      }
    }

    if (type === "submit") {
      fields.push({ element: input, type: "submit", confidence: 0.9 });
    }
  });

  return fields;
}

function scoreUsernameField(input: HTMLInputElement): number {
  let score = 0;

  const attrs: Record<string, string | null> = {
    name: input.name,
    id: input.id,
    placeholder: input.placeholder?.toLowerCase() ?? null,
    autocomplete: input.autocomplete,
    type: input.type,
  };

  for (const [, value] of Object.entries(attrs)) {
    if (!value) continue;
    const lower = value.toLowerCase();

    if (lower === "username" || lower === "email") {
      score += 0.5;
    }
    if (
      lower.includes("user") ||
      lower.includes("login") ||
      lower.includes("account")
    ) {
      score += 0.3;
    }
    if (lower.includes("name") && !lower.includes("first") && !lower.includes("last")) {
      score += 0.2;
    }
  }

  // Check autocomplete attribute
  if (input.autocomplete === "username" || input.autocomplete === "email") {
    score += 0.4;
  }

  return Math.min(score, 1);
}
