import type { Vault, VaultItem, LoginFields, CardFields, NoteFields, IdentityFields } from "@ironlox/schemas";

/**
 * Constant-time string comparison.
 * Prevents timing attacks on secret comparisons (passwords, tokens, hashes).
 * Both strings must be the same length; caller should hash before comparing.
 *
 * @param a - first string
 * @param b - second string
 * @returns true if strings are equal
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Parse a CSV import file into vault items.
 * Expected columns: type, name, uri, username, password, notes, tags
 *
 * @param csvContent - raw CSV string
 * @returns array of VaultItem (without IDs — caller assigns)
 */
export function importExportCsv(csvContent: string): Partial<VaultItem>[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const items: Partial<VaultItem>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]!] = values[j] ?? "";
    }

    const type = record.type ?? "login";
    const name = record.name ?? "Imported Item";
    const tagsStr = record.tags ?? "";
    const tags = tagsStr ? tagsStr.split(";").map((t) => t.trim()).filter(Boolean) : [];

    let fields: LoginFields | CardFields | NoteFields | IdentityFields;

    switch (type) {
      case "login":
        fields = {
          username: record.username ?? "",
          password: record.password ?? "",
          uris: record.uri ? [record.uri] : undefined,
          notes: record.notes ?? undefined,
        } satisfies LoginFields;
        break;
      case "card":
        fields = {
          cardholder: record.cardholder ?? "",
          number: record.number ?? "",
          expiryMonth: record.expiryMonth ?? "",
          expiryYear: record.expiryYear ?? "",
          cvv: record.cvv ?? "",
          brand: record.brand ?? undefined,
          notes: record.notes ?? undefined,
        } satisfies CardFields;
        break;
      case "note":
        fields = {
          content: record.content ?? record.notes ?? "",
        } satisfies NoteFields;
        break;
      case "identity":
        fields = {
          firstName: record.firstName ?? undefined,
          lastName: record.lastName ?? undefined,
          email: record.email ?? undefined,
          phone: record.phone ?? undefined,
          address: record.address ?? undefined,
          notes: record.notes ?? undefined,
        } satisfies IdentityFields;
        break;
      default:
        fields = {
          username: record.username ?? "",
          password: record.password ?? "",
          uris: record.uri ? [record.uri] : undefined,
          notes: record.notes ?? undefined,
        } satisfies LoginFields;
    }

    items.push({ type: type as VaultItem["type"], name, tags, fields });
  }

  return items;
}

/**
 * Export vault items to CSV format.
 *
 * @param vault - the vault to export
 * @returns CSV string
 */
export function exportVaultToCsv(vault: Vault): string {
  const headers = ["type", "name", "uri", "username", "password", "notes", "tags"];
  const rows = vault.items.map((item) => {
    const fields = item.fields;
    const row: string[] = [
      item.type,
      item.name,
      "uris" in fields ? (fields.uris?.[0] ?? "") : "",
      "username" in fields ? fields.username : "",
      "password" in fields ? fields.password : "",
      "notes" in fields ? (fields.notes ?? "") : "",
      item.tags.join(";"),
    ];
    return row.map((v) => {
      const escaped = v.replace(/"/g, '""');
      const safe = escaped.startsWith("=") || escaped.startsWith("+") || escaped.startsWith("-") || escaped.startsWith("@")
        ? "'" + escaped
        : escaped;
      return `"${safe}"`;
    }).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}
