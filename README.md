# Ironlox

Zero-knowledge consumer password manager. Encryption happens client-side only — the server never sees your plaintext.

[![CI](https://github.com/ironlox/ironlox/actions/workflows/ci.yml/badge.svg)](https://github.com/ironlox/ironlox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- **Zero-knowledge architecture** — all encryption/decryption happens on the client
- **AES-256-GCM** encrypted vault, stored as an opaque blob in R2
- **Argon2id** key derivation with separate salts for auth and encryption
- Browser extension with autofill support (Chrome + Firefox)
- Web dashboard for vault management
- TOTP 2FA support
- Secure credential sharing with zero-knowledge guarantees
- Import/export from other password managers

## Architecture

```
User → Browser Extension (Plasmo) → Autofill on pages
         ↕ Hono RPC (JWT)
User → Web App (Next.js CSR) → Vault management
         ↕ Hono RPC (JWT)
User → Marketing Site (Astro, static) → ironlox.com

Cloudflare Workers (Hono) → D1 (metadata) + R2 (blobs) + KV (flags/limits)
```

All client-server communication uses typed [Hono RPC](https://hono.dev/docs/guides/rpc) with [Zod](https://zod.dev/) validation.

## Project Structure

```
ironlox/
├── apps/
│   ├── worker/          # Cloudflare Workers API (Hono + Hono RPC)
│   ├── web/             # React/Next.js dashboard (CSR only)
│   ├── extension/       # Plasmo browser extension (Chrome + Firefox)
│   └── marketing/       # Astro static site (ironlox.com)
├── packages/
│   ├── crypto/          # Encryption, key derivation, TOTP
│   ├── schemas/         # Zod schemas, shared types
│   ├── autofill/        # Form detection, URL matching
│   └── api-client/      # Typed Hono RPC client
└── docs/                 # Product spec, roadmap
```

## Quick Start

### Prerequisites

- Node.js >= 22
- pnpm >= 9
- Cloudflare account (Workers, D1, R2, KV)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Installation

```bash
pnpm install
cp .env.example .env
# Edit .env with your configuration
pnpm run dev
```

### Common Commands

```bash
pnpm run dev          # Start all apps in dev mode
pnpm run build        # Build all packages and apps
pnpm run test         # Run all tests
pnpm run typecheck    # Type-check all packages
pnpm run lint         # Lint all packages
pnpm run format       # Format all files with Prettier
```

## Security

Ironlox is designed with a zero-knowledge architecture:

- The master password never leaves the client
- Encryption/decryption uses the Web Crypto API, client-side only
- Vault blobs are AES-256-GCM encrypted with envelope encryption
- Constant-time comparison for all secret values
- PII scrubbing on all error capture

Report security issues to [security@ironlox.com](mailto:security@ironlox.com). See [SECURITY.md](SECURITY.md) for our full security policy.

## Documentation

- [Product Specification](docs/product-spec.md)
- [Development Roadmap](docs/roadmap.md)
- [Deployment Guide](DEPLOY.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
