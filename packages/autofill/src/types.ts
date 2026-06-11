export type UrlMatchType = "host" | "base_domain" | "starts_with" | "regex";

export interface DetectedField {
  element: HTMLElement;
  type: "username" | "password" | "totp" | "email" | "submit";
  name?: string;
  id?: string;
  placeholder?: string;
  autocomplete?: string;
  confidence: number; // 0-1
}

export interface DetectedForm {
  element: HTMLFormElement;
  fields: DetectedField[];
  confidence: number;
}
