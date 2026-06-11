import { describe, it, expect } from "vitest";
import { matchUrl } from "../src/url-matcher.js";

describe("URL matcher", () => {
  it("matches exact hostname", () => {
    expect(matchUrl("https://example.com", "https://example.com", "host")).toBe(true);
    expect(matchUrl("https://example.com", "https://example.com/login", "host")).toBe(true);
  });

  it("rejects different hostname", () => {
    expect(matchUrl("https://example.com", "https://other.com", "host")).toBe(false);
    expect(matchUrl("https://example.com", "https://login.example.com", "host")).toBe(false);
  });

  it("matches base domain", () => {
    expect(
      matchUrl("https://example.com", "https://login.example.com", "base_domain"),
    ).toBe(true);
    expect(
      matchUrl("https://login.example.com", "https://app.example.com", "base_domain"),
    ).toBe(true);
  });

  it("rejects different base domain", () => {
    expect(
      matchUrl("https://example.com", "https://other.com", "base_domain"),
    ).toBe(false);
  });

  it("matches starts_with", () => {
    expect(
      matchUrl("https://example.com", "https://example.com/dashboard", "starts_with"),
    ).toBe(true);
  });

  it("rejects non-matching starts_with", () => {
    expect(
      matchUrl("https://example.com/app", "https://example.com", "starts_with"),
    ).toBe(false);
  });

  it("matches regex", () => {
    expect(
      matchUrl("example\\.(com|org)", "https://example.org", "regex"),
    ).toBe(true);
  });

  it("returns false for invalid URLs", () => {
    expect(matchUrl("not-a-url", "https://example.com")).toBe(false);
    expect(matchUrl("https://example.com", "not-a-url")).toBe(false);
  });

  it("default match type is host", () => {
    expect(matchUrl("https://example.com", "https://example.com")).toBe(true);
    expect(matchUrl("https://example.com", "https://other.com")).toBe(false);
  });
});
