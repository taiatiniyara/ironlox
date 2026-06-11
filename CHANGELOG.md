# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial monorepo setup with Turborepo and pnpm workspaces
- `@ironlox/tsconfig` — shared TypeScript base config
- `@ironlox/crypto` — client-side encryption (AES-256-GCM), key derivation (Argon2id), TOTP, password generation, recovery keys, vault CRUD
- `@ironlox/schemas` — Zod schemas and shared types for vault items, auth, account endpoints
- `@ironlox/api-client` — typed HTTP client (hand-rolled, Hono RPC planned)
- `@ironlox/autofill` — form detection and URL matching for browser extension
- `@ironlox/worker` — Cloudflare Workers API (Hono): auth (register/login/refresh/revoke), vault (CRUD + attachments), account (info/delete/undelete/password), Stripe webhooks, MailChannels email, rate limiting, MFA/recovery (all 501 stubs)
- `@ironlox/web` — React/Next.js dashboard (CSR only): login/signup, vault list with search, add items (login/card/note/identity), settings panel
- `@ironlox/extension` — Plasmo browser extension (Chrome + Firefox): popup with vault list/search, item detail, autofill content script, TOTP display, password generator, offline IndexedDB cache
- `@ironlox/marketing` — Astro static site: home, privacy, security, terms pages
- CI pipeline with typecheck, lint, test (crypto coverage gate planned), deploy, and release workflows
- Crypto test suite: unit tests + property-based tests (fast-check) + known-vector tests (AES-GCM, Argon2id, TOTP RFC 6238)
- Zero-knowledge architecture: client-side encryption only, server never sees plaintext

[Unreleased]: https://github.com/ironlox/ironlox/compare/v0.1.0...HEAD
