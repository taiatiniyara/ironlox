import { describe, it, expect } from "vitest";
import { constantTimeEqual, importExportCsv, exportVaultToCsv } from "../src/utils.js";
import { createEmptyVault } from "../src/vault.js";

describe("constantTimeEqual", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(constantTimeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different length strings", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("returns false for case differences", () => {
    expect(constantTimeEqual("ABC", "abc")).toBe(false);
  });
});

describe("CSV import", () => {
  it("parses login items", () => {
    const csv = `type,name,uri,username,password,notes,tags
login,Google,https://google.com,user@example.com,secret123,,work`;
    const items = importExportCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0]!.type).toBe("login");
    const fields = items[0]!.fields;
    expect("username" in fields && fields.username).toBe("user@example.com");
    expect("password" in fields && fields.password).toBe("secret123");
    expect(items[0]!.tags).toEqual(["work"]);
  });

  it("parses card items", () => {
    const csv = `type,name,cardholder,number,expiryMonth,expiryYear,cvv,notes
card,Visa,John Doe,4111111111111111,12,2028,123,`;
    const items = importExportCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0]!.type).toBe("card");
    const fields = items[0]!.fields;
    expect("number" in fields && fields.number).toBe("4111111111111111");
  });

  it("returns empty array for empty CSV", () => {
    expect(importExportCsv("")).toEqual([]);
    expect(importExportCsv("type,name\n")).toEqual([]);
  });

  it("handles quoted fields", () => {
    const csv = `type,name,uri,username,password,notes,tags
login,"My, Site","https://test.com",user,pass,"note,with,commas",`;
    const items = importExportCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe("My, Site");
  });
});

describe("CSV export", () => {
  it("exports vault to CSV", () => {
    const vault = createEmptyVault();
    vault.items.push({
      id: crypto.randomUUID(),
      type: "login",
      name: "Test",
      tags: ["work"],
      folderId: null,
      fields: {
        username: "user",
        password: "pass",
        uris: ["https://test.com"],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const csv = exportVaultToCsv(vault);
    expect(csv).toContain("type,name,uri,username,password,notes,tags");
    expect(csv).toContain("Test");
    expect(csv).toContain("user");
    expect(csv).toContain("https://test.com");
  });
});
