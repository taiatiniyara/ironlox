import { describe, it, expect } from "vitest";
import { generatePassword, generatePassphrase } from "../src/generator.js";

describe("Password generator", () => {
  it("generates password of correct length", () => {
    const pw = generatePassword({ length: 20 });
    expect(pw.length).toBe(20);
  });

  it("generates password with all character sets by default", () => {
    const pw = generatePassword();
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[0-9]/);
    expect(pw).toMatch(/[\]!@#$%^&*()_+=[{}|;:,.<>?-]/);
  });

  it("generates lowercase-only password", () => {
    const pw = generatePassword({
      uppercase: false,
      numbers: false,
      symbols: false,
    });
    expect(pw).toMatch(/^[a-z]+$/);
  });

  it("generates different passwords each time", () => {
    const pw1 = generatePassword();
    const pw2 = generatePassword();
    expect(pw1).not.toBe(pw2);
  });

  it("generates password of minimum length", () => {
    const pw = generatePassword({ length: 8 });
    expect(pw.length).toBe(8);
  });
});

describe("Passphrase generator", () => {
  it("generates passphrase with correct word count", () => {
    const phrase = generatePassphrase({ wordCount: 4, separator: "-" });
    const words = phrase.split("-");
    expect(words).toHaveLength(4);
  });

  it("uses custom separator", () => {
    const phrase = generatePassphrase({ wordCount: 3, separator: " " });
    expect(phrase.split(" ")).toHaveLength(3);
  });

  it("generates different passphrases each time", () => {
    const p1 = generatePassphrase();
    const p2 = generatePassphrase();
    expect(p1).not.toBe(p2);
  });

  it("capitalizes words when asked", () => {
    const phrase = generatePassphrase({ wordCount: 3, capitalize: true });
    const words = phrase.split("-");
    for (const word of words) {
      expect(word[0]).toBe(word[0]!.toUpperCase());
    }
  });
});
