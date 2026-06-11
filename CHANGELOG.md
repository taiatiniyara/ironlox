# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial monorepo setup with Turborepo and pnpm workspaces
- `@ironlox/crypto` — client-side encryption (AES-256-GCM), key derivation (Argon2id), TOTP
- `@ironlox/schemas` — Zod schemas and shared types
- `@ironlox/api-client` — typed Hono RPC client
- `@ironlox/autofill` — form detection and URL matching for browser extension
- `@ironlox/worker` — Cloudflare Workers API (Hono, D1, R2, KV)
- `@ironlox/web` — React/Next.js dashboard (CSR only)
- `@ironlox/extension` — Plasmo browser extension (Chrome + Firefox)
- `@ironlox/marketing` — Astro static marketing site
- CI pipeline with typecheck, lint, test, and crypto coverage gate
- Zero-knowledge architecture: client-side encryption only, server never sees plaintext

[Unreleased]: https://github.com/ironlox/ironlox/compare/v0.1.0...HEAD
