import type { UrlMatchType } from "./types.js";

/**
 * Match a website URL against a stored URI using configurable match rules.
 *
 * @param uri - stored URI from vault item
 * @param currentUrl - current browser URL
 * @param matchType - match strategy (default: "host")
 * @returns true if the URLs match according to the strategy
 */
export function matchUrl(
  uri: string,
  currentUrl: string,
  matchType: UrlMatchType = "host",
): boolean {
  // Handle regex before URL parsing (regex patterns are not valid URLs)
  if (matchType === "regex") {
    try {
      const regex = new RegExp(uri);
      return regex.test(currentUrl);
    } catch {
      return false;
    }
  }

  try {
    const stored = new URL(uri);
    const current = new URL(currentUrl);

    switch (matchType) {
      case "host":
        return stored.hostname === current.hostname;

      case "base_domain":
        return getBaseDomain(stored.hostname) === getBaseDomain(current.hostname);

      case "starts_with":
        return current.href.startsWith(uri);

      default:
        return stored.hostname === current.hostname;
    }
  } catch {
    return false;
  }
}

/**
 * Extract the base domain from a hostname.
 * e.g., "login.example.com" → "example.com"
 * Handles common TLDs and country-level domains.
 */
function getBaseDomain(hostname: string): string {
  const parts = hostname.split(".");

  if (parts.length <= 2) return hostname;

  // Handle country-level domains like example.co.uk
  const sld = parts[parts.length - 2]!;

  if (
    sld.length <= 3 &&
    ["co", "com", "org", "net", "gov", "edu", "ac", "ne", "or", "go"].includes(sld)
  ) {
    if (parts.length <= 3) return hostname;
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}
