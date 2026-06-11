# Security Policy

## Reporting a Vulnerability

**Do not file public issues for security vulnerabilities.**

Email security issues to **[security@ironlox.com](mailto:security@ironlox.com)**.

We will respond within 48 hours acknowledging your report. You will receive updates as we investigate and resolve the issue.

## Disclosure Policy

- We follow a 90-day disclosure timeline
- We will coordinate public disclosure with you after the fix is deployed
- You will be credited in our Hall of Fame (unless you prefer to remain anonymous)

## Security Model

Ironlox is a zero-knowledge password manager:

- **Encryption/decryption happens client-side only** using the Web Crypto API
- **The master password never leaves the client** — the server receives only a derived auth hash (Argon2id, different salt than the encryption key)
- **Vault blobs are AES-256-GCM encrypted** with envelope encryption: the vault key is wrapped by a master-password-derived key
- **All crypto is in `packages/crypto`** — consumed by the web app and browser extension, never by the server
- **No client-side analytics or tracking** — only server-side operational metrics
- **PII is aggressively scrubbed** from all error capture

## Scope

This security policy covers:

- The Ironlox web application (app.ironlox.com)
- The Ironlox API (api.ironlox.com)
- The Ironlox browser extension (Chrome + Firefox)
- The `@ironlox/crypto` package

Issues with the marketing site (ironlox.com) or documentation should be reported as regular issues.

## PGP Key

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
(Coming soon — check back or email security@ironlox.com)
-----END PGP PUBLIC KEY BLOCK-----
```

## Hall of Fame

We maintain a security hall of fame at [ironlox.com/security](https://ironlox.com/security) for researchers who have responsibly disclosed vulnerabilities.

## Out of Scope

- Theoretical attacks without a working proof of concept
- Social engineering or phishing attacks
- Denial of service attacks
- Issues in third-party services (Cloudflare, Stripe, etc.)

## Bug Bounty

We do not currently offer a paid bug bounty program. We are grateful for all responsible disclosures and will publicly acknowledge verified reports.
