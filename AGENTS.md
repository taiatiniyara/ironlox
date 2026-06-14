# Ironlox — Agent Instructions

## Project

Ironlox is a zero-knowledge consumer password manager. Users store passwords, credit cards, secure notes, and identities in an encrypted vault. Encryption/decryption happens client-side only. The server never sees plaintext.

**Stack**: TypeScript everywhere — Cloudflare Workers (API), React/Next.js (web app), Plasmo (browser extension), Tailwind CSS + shadcn/ui (UI), D1 (SQLite DB), R2 (blob storage), KV (feature flags/rate limiting).

**Monorepo**: Turborepo + pnpm workspaces. Apps: `apps/worker`, `apps/web`, `apps/extension`, `apps/marketing`. Packages: `packages/crypto`, `packages/schemas`, `packages/autofill`, `packages/api-client`, `packages/tsconfig`.

**Current state**: Phase 0 (Foundation) done. Phase 1 (Core Backend) done except MFA/recovery endpoints (501 stubs). Phase 2 (Web App) complete — 16 static pages, shadcn/ui, full vault CRUD with server sync, Fuse.js search, premium tier gating (TOTP, vault health, custom fields, tags, export, 2GB attachments), Stripe Checkout + Customer Portal billing, security dashboard with HIBP, import/export, file attachments, i18n (EN). Phase 3 (Extension) ~85% — real auth, vault sync, autofill with TOTP, add/edit/delete items, keyboard shortcuts, clipboard auto-clear, PIN unlock, context menu, 5 recents, conflict resolution. Phase 4 (Marketing) content-complete. See `docs/roadmap.md` for per-item status.

**Key docs**: `docs/product-spec.md` (full spec), `docs/roadmap.md` (phased plan).

---

## Security Principles (non-negotiable)

1. **Encryption/decryption never happens on the server.** All crypto in `packages/crypto`, consumed by `apps/web` and `apps/extension`.
2. **Master password never leaves the client.** Server receives only a derived auth hash (Argon2id, different salt than the encryption key).
3. **Vault blob is AES-256-GCM encrypted.** Stored in R2 as an opaque blob. Envelope encryption: vault key wrapped by master-password-derived key.
4. **No client-side analytics or tracking.** Server-side metrics only (Cloudflare Analytics Engine, D1 query counts). Opt-in crash reporting with aggressive PII scrubbing.
5. **Passwords show/hide with eye icon, auto-hide after 30s.** Clipboard auto-clears after 60s (configurable).
6. **Never log plaintext, never log encryption keys, never log auth hashes.** PII scrubbing on all error capture.

---

## Architecture

```
User → Browser Extension (Plasmo) → Autofill on pages
         ↕ Hono RPC (JWT)
User → Web App (Next.js CSR) → Vault management
         ↕ Hono RPC (JWT)
User → Marketing Site (Astro, static) → ironlox.com
         ↕
Cloudflare Workers (Hono) → D1 (metadata) + R2 (blobs) + KV (flags/limits)
```

Client ↔ server communication via `@ironlox/api-client` (currently a hand-rolled typed HTTP client — will be replaced with Hono RPC client once the full API route types are generated). Zod schemas from `@ironlox/schemas` validate all request/response payloads.

---

## Directory Structure

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
│   ├── api-client/      # Typed HTTP client (Hono RPC planned)
│   └── tsconfig/        # Shared TypeScript base config
├── docs/
│   ├── product-spec.md
│   └── roadmap.md
├── AGENTS.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Development Workflow

### Prerequisites
- Node.js >= 22
- pnpm >= 9
- Cloudflare account (Workers, D1, R2, KV)
- Wrangler CLI (`pnpm add -g wrangler`)

### Setup
```bash
pnpm install
pnpm run dev       # Starts all apps in dev mode
```

### Common Commands
```bash
# Type checking (all packages)
pnpm run typecheck

# Linting
pnpm run lint

# Tests
pnpm run test              # All tests
pnpm run test --filter=@ironlox/crypto   # Crypto only (must pass)
pnpm run test:e2e          # E2E tests (Playwright)

# Worker (API)
pnpm run dev --filter=@ironlox/worker     # Local dev (miniflare)
pnpm run deploy --filter=@ironlox/worker  # Deploy to Cloudflare

# D1
pnpm run migrations:apply --filter=@ironlox/worker
pnpm run migrations:create --filter=@ironlox/worker --name=add_table

# Web app
pnpm run dev --filter=@ironlox/web

# Extension
pnpm run dev --filter=@ironlox/extension    # Chrome
pnpm run dev:firefox --filter=@ironlox/extension

# Extension build (for store submission)
pnpm run build --filter=@ironlox/extension
pnpm run package --filter=@ironlox/extension

# Marketing site
pnpm run dev --filter=@ironlox/marketing

# Graphify — knowledge graph for codebase navigation
pnpm run graphify                            # Full pipeline on .
pnpm run graphify:update                     # Incremental — re-extract only new/changed files
pnpm run graphify:watch                      # Watch for changes, auto-rebuild graph
pnpm run graphify:query "<question>"         # BFS traversal of knowledge graph
pnpm run graphify:explain "<node>"           # Plain-language explanation of a node
pnpm run graphify:path "<nodeA>" "<nodeB>"   # Shortest path between two concepts
```

---

## Coding Conventions

### General
- TypeScript strict mode everywhere. No `any` unless absolutely necessary (justify with comment).
- Prefer functions over classes. Pure functions over side effects.
- All user-facing strings in `en.json` translation files (i18next). Never hardcode strings in JSX.
- UUIDv4 for all IDs. ISO 8601 for all timestamps. UTC only.
- `@/` path alias maps to package/app root.

### React / Web App
- shadcn/ui components (`npx shadcn@latest add [component]`). Currently installed with 18 primitives (button, input, label, card, badge, separator, dropdown-menu, select, dialog, skeleton, toggle, tabs, table, textarea, popover, tooltip, switch, checkbox, slider, progress, sonner). Use Tailwind v4 + `@base-ui/react` primitives. Prefer existing shadcn/ui components over raw HTML.
- Tailwind CSS only. No CSS modules or styled-components.
- No React Server Components. Everything is CSR (`"use client"` where needed).
- Do not use `useEffect` where server state libraries (TanStack Query) are appropriate.
- All API calls go through `packages/api-client`, never raw `fetch()`.
- All user-facing strings go in `en.json` (i18next). Currently partially adopted — hardcoded strings still exist in JSX.

### Extension (Plasmo)
- Minimum permissions only: `storage`, `activeTab`, `clipboardWrite`, `host_permissions: ["<all_urls>"]`.
- Popup is 350x500px fixed. No scroll-jacking. Bottom-anchored CTA.
- Use Plasmo's messaging API for background script ↔ popup communication.
- Test on both Chrome and Firefox before submitting.

### Worker (Cloudflare Workers)
- Hono for routing. Zod for validation. Hono RPC for client generation.
- Stateless. No mutable shared state between requests.
- Every route: validate input (Zod) → authorize (JWT middleware) → execute → return typed response.
- D1 queries: use parameterized queries, never string interpolation.
- File uploads to R2: signed URLs (not streaming through Worker).

### Crypto (`packages/crypto`)
- **The most critical package.** Changes must be reviewed carefully.
- All exports: named, pure, synchronous where possible. No mutable state.
- No third-party crypto beyond Web Crypto API (SubtleCrypto). No `node:crypto`.
- Constant-time comparison for all secret values.
- Every function must have:
  - Unit tests with known vectors
  - Property-based tests (`fast-check`)
  - Clear JSDoc with algorithm reference and parameters

---

## Testing Requirements

### Crypto (`packages/crypto`) — GATE
- **100% branch coverage required.** CI should fail on drop (coverage threshold not yet enforced in CI workflow — needs `vitest --coverage` and threshold config).
- Property-based: `decrypt(encrypt(x)) == x` for all inputs.
- Known vectors: AES-GCM (NIST), Argon2id, TOTP (RFC 6238), HKDF.
- Constant-time comparison tests.
- Fuzz testing for parsers (CSV import, JSON export).
- **Do not merge to main if crypto tests fail.**

### API (`apps/worker`) — GATE
- Integration tests against Miniflare + D1/R2 emulation.
- Every endpoint: test happy path + auth failure + invalid input + rate limit.
- Webhook handlers: test Stripe + MailChannels payloads.

### Web App & Extension
- Component tests (Vitest + Testing Library) for critical components.
- E2E (Playwright): signup → add password → sync → autofill → search → export.
- axe-core accessibility audit in E2E pipeline.
- Extension E2E: top 50 sites autofill test.

---

## Before Submitting a PR

- [ ] `pnpm run typecheck` passes (all packages)
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes (all packages, crypto at 100%)
- [ ] No new warnings in any package
- [ ] If crypto changed: property-based tests pass, coverage maintained
- [ ] If API changed: endpoint tests cover new/modified routes
- [ ] If UI changed: loading + empty + error states handled
- [ ] No hardcoded strings (use i18next key)
- [ ] No secrets/keys in code (use environment variables)
- [ ] No `console.log` in production code (use Sentry for errors)
- [ ] PR references spec section(s) from `docs/product-spec.md`
- [ ] Graphify graph is up to date (`pnpm run graphify:update` if files changed)

---

## Dos and Don'ts

### Do
- Read `docs/product-spec.md` before starting any feature work.
- Check `docs/roadmap.md` for timing, dependencies, and completion status.
- Use `@ironlox/schemas` Zod types for all data structures.
- Use `@ironlox/api-client` for all API calls (currently hand-rolled, Hono RPC planned).
- Use `@ironlox/crypto` for all encryption, key derivation, and TOTP.
- Add `.well-known/security.txt` to the marketing site.
- Send security bug reports to `security@ironlox.com`, not public issues.
- Prefix feature branch: `feat/`, bug fix: `fix/`, docs: `docs/`, chore: `chore/`.

### Don't
- **Never implement encryption outside `packages/crypto`.**
- **Never send the master password to the server.**
- **Never log plaintext, keys, or auth hashes.**
- **Never add third-party analytics/tracking scripts to any client.**
- Don't use `any` or `as` casts on security-critical code.
- Don't use `fetch()` directly — use Hono RPC client.
- Don't bypass Zod validation — all inputs validated at the API boundary.
- Don't introduce new dependencies without justification in the PR description.
- Don't ship commented-out code.
- Don't use emojis in commit messages, PRs, or comments.

---

## Environment Variables

```
# Workers
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
D1_DATABASE_ID=
R2_BUCKET_NAME=
KV_NAMESPACE_ID=
MAILCHANNELS_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SENTRY_DSN=
TURNSTILE_SECRET_KEY=
JWT_SECRET=

# Extension
PLASMO_PUBLIC_API_URL=
PLASMO_PUBLIC_SENTRY_DSN=

# Web App
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

---

## References

- Product spec: `docs/product-spec.md`
- Roadmap: `docs/roadmap.md`
- Vault data model: `docs/product-spec.md#53-vault-data-model-encrypted-blob-schema`
- API endpoints: `docs/product-spec.md#224-api-endpoint-inventory`
- Crypto requirements: `docs/product-spec.md#4-encryption-model`
- Security disclosure: `docs/product-spec.md#351-security-disclosure`
