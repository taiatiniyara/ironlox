# Ironlox Development Roadmap

> **Status key**: ✅ complete &nbsp; 🔶 partial / stub &nbsp; ❌ not started
>
> **Overall**: Foundation (Phase 0) done. Core Backend (Phase 1) done except MFA/recovery (all 501 stubs). Web app and extension in early prototype — single-file implementations with working UIs. Marketing site is content-complete with polished landing page, legal pages, SEO, and security.txt. No deployment infra filled in yet (Cloudflare resource IDs, secrets all blank).

---

## Phase 0: Foundation (Week 1-2)

### Monorepo Setup
- [x] Initialize Turborepo with pnpm workspaces ✅
- [x] Configure TypeScript base config (`@ironlox/tsconfig`) ✅
- [x] Configure ESLint + Prettier across all packages ✅
- [ ] Set up Husky pre-commit hooks (lint-staged) ❌
- [x] Set up Graphify for dependency/architecture visualization ✅

### Shared Packages
- [x] `packages/crypto` — AES-256-GCM encrypt/decrypt, Argon2id key derivation, TOTP (RFC 6238), envelope encryption ✅
- [x] `packages/schemas` — Zod schemas for vault data model, API request/response types ✅
- [x] `packages/autofill` — form detection heuristics, URL matching engine ✅
- [x] `packages/api-client` — typed HTTP client (hand-rolled, not Hono RPC yet) 🔶

### CI/CD
- [x] GitHub Actions: CI pipeline (lint, typecheck, test) on every PR ✅
- [x] GitHub Actions: Deploy pipeline (deploy worker, deploy web, build extension) on merge to main ✅
- [x] GitHub Actions: Release pipeline (publish extension) on manual trigger ✅
- [ ] Turborepo remote caching configured ❌

### Crypto Test Suite
- [x] 100% branch coverage ✅
- [x] Property-based tests: `decrypt(encrypt(x)) == x` ✅
- [x] Known-vector tests: AES-GCM (NIST), Argon2id (reference), TOTP (RFC 6238) ✅
- [x] Constant-time comparison tests ✅

---

## Phase 1: Core Backend (Week 2-4)

### Cloudflare Workers API (`apps/worker`)
- [x] Hono + Hono RPC setup ✅
- [ ] Hono Zod OpenAPI (auto-generated spec) — installed but not used to generate spec 🔶
- [x] CORS middleware ✅
- [x] Error handling middleware ✅

### D1 Database
- [x] Wrangler migrations setup ✅
- [x] Schema: `users`, `refresh_tokens`, `login_events`, `attachment_meta` ✅
- [ ] Migration CI step ❌

### R2 Blob Storage
- [x] Bucket setup (config exists, needs production IDs) 🔶
- [x] Object versioning (7-day retention) 🔶
- [x] Signed URL generation for vault/attachment access ✅

### Authentication Endpoints
- [x] `POST /auth/register` — create account, derive auth hash, store in D1 ✅
- [x] `POST /auth/login` — verify auth hash, issue JWT + refresh token ✅
- [x] `POST /auth/refresh` — rotate refresh token ✅
- [x] `POST /auth/revoke` — revoke refresh token ✅
- [ ] `POST /auth/mfa/enable` — store TOTP secret ❌ (501 stub)
- [ ] `POST /auth/mfa/verify` — verify TOTP during login ❌ (501 stub)
- [ ] `POST /auth/mfa/webauthn/register` — passkey registration ❌ (501 stub)
- [ ] `POST /auth/mfa/webauthn/verify` — passkey verification ❌ (501 stub)
- [ ] `POST /auth/recover` — recovery key login ❌ (501 stub, lives in `mfa.ts`)

### Vault Endpoints
- [x] `GET /vault` — return signed R2 URL + version ✅
- [x] `PUT /vault` — optimistic locking (version check), upload to R2 ✅
- [x] `GET /vault/attachment/:id` — signed R2 URL ✅
- [x] `PUT /vault/attachment/:id` — upload attachment (quota check) ✅
- [x] `DELETE /vault/attachment/:id` — delete attachment ✅

### Account Endpoints
- [x] `GET /account` — user info, tier, quota, login events ✅
- [x] `DELETE /account` — soft delete (7-day grace period) ✅
- [x] `POST /account/undelete` — cancel deletion ✅
- [x] `PUT /account/password` — re-wrap vault key ✅

### Infrastructure
- [x] MailChannels integration (email verification, alerts) ✅
- [x] Stripe webhook handler (subscription create/update/cancel) ✅
- [x] KV rate limiting (Turnstile trigger + IP cooldown) ✅
- [ ] KV feature flags (kill switches) ❌
- [x] `GET /health` endpoint ✅
- [ ] Sentry (Workers SDK) error tracking ❌

---

## Phase 2: Web App (Week 4-7)

### React / Next.js Setup (`apps/web`)
- [x] Next.js (CSR only, no RSC) ✅
- [ ] shadcn/ui (not installed — custom HTML components used) ❌
- [x] Tailwind CSS ✅
- [x] Dark gray theme (dark mode only, no light mode toggle) 🔶
- [x] Inter + JetBrains Mono fonts ✅
- [ ] Responsive: mobile cards, desktop table ❌
- [x] Sonner toast notifications ✅
- [ ] Skeleton loading states ❌
- [ ] Empty states with CTAs ❌
- [x] i18next setup with `en.json` (translations exist but many strings still hardcoded) 🔶

### Auth UI
- [x] Login / Signup — single page with email + master password (no separate routes) 🔶
- [ ] MFA setup & verify pages ❌
- [ ] Passkey registration & verify pages ❌
- [ ] Recovery key login page ❌
- [ ] Account deletion confirmation + undelete ❌

### Onboarding Flow
- [ ] 3-option landing: Import / Add first password / Demo vault ❌
- [ ] Recovery key generation with mandatory save acknowledgement ❌
- [ ] Demo vault (3 pre-populated items, one-click clear) ❌

### Vault Browser
- [x] Vault list with search (Fuse.js fuzzy) — in single page.tsx, no routing 🔶
- [ ] Separate vault route (`/vault`) ❌
- [ ] Category filter (Login, Card, Note, Identity) ❌
- [ ] Tag filter ❌
- [ ] Sort: name, date created, date updated, recently used ❌
- [ ] 5 most recent items pinned ❌
- [x] Item detail view with masked/unmasked fields 🔶
- [ ] Custom fields (text + hidden) ❌
- [x] Password show/hide toggle (eye icon) 🔶
- [ ] Password generator inline (random + passphrase) ❌

### Add / Edit Items
- [x] Login, Card, Note, Identity forms — basic, no validation ❌ (basic forms exist, no Zod client-side validation)
- [ ] URIs max 3 enforcement ❌
- [ ] Password history (last 5, client-side) ❌
- [ ] Custom fields (add/remove key-value pairs) ❌

### Security Dashboard
- [ ] HIBP breach check ❌
- [ ] Reused password detection ❌
- [ ] Weak password detection (zxcvbn) ❌ (zxcvbn installed but not used)
- [ ] Password aging (>2 years) ❌
- [ ] 2FA audit ❌

### Settings
- [x] Settings panel (lightweight, in single page.tsx) 🔶
- [ ] Change email (OTP flow) ❌
- [ ] Change master password (re-wrap key) ❌
- [ ] MFA setup/disable UI ❌
- [ ] Recovery key view/regenerate ❌
- [x] Login history ❌ (exists in worker but no UI)
- [ ] Vault timeout, clipboard auto-clear preferences ❌
- [ ] Stripe Customer Portal link ❌
- [ ] Delete account UI ❌

### Import / Export
- [x] CSV parse/export in `@ironlox/crypto` (no UI) 🔶
- [ ] CSV import with field-mapping UI ❌
- [ ] CSV template download ❌
- [ ] Plaintext CSV export (with security warning) ❌
- [ ] Password-protected JSON export ❌

### File Attachments
- [ ] Upload, download, delete UI ❌ (worker API supports it)
- [ ] Quota display ❌

---

## Phase 3: Browser Extension (Week 5-8, overlaps Phase 2)

### Plasmo Setup (`apps/extension`)
- [x] Plasmo project init ✅
- [ ] shadcn/ui components — not installed ❌
- [x] Dark gray theme ✅
- [x] Manifest V3: `storage`, `activeTab`, `clipboardWrite`, `host_permissions: ["<all_urls>"]` ✅

### Popup UI
- [x] Locked state: master password or PIN entry ✅
- [x] Vault list: search + category filter ✅ (search only, no filters)
- [ ] 5 recents pinned at top ❌
- [x] Item detail: view, copy username/password/TOTP ✅
- [ ] Edit item ❌
- [x] Add item 🔶 (basic form)
- [x] Password generator (inline popover) ✅
- [x] Settings panel (lightweight) 🔶

### Autofill Engine
- [x] Form detection: password field heuristic → walk backward for username ✅
- [ ] Domain rule database (top 500 sites) ❌
- [x] URL matching: host default, base domain, starts with, regex ✅
- [ ] Inline autofill suggestion on login pages ❌
- [ ] Context menu on form fields ❌
- [x] TOTP code display with live countdown ✅ (auto-copy after fill not done)

### Sync Client
- [x] Encrypted vault fetch from R2 (signed URL) — VaultSync class exists, not connected to server 🔶
- [x] Vault decrypt local → IndexedDB cache ✅
- [ ] Optimistic locking: version check before upload ❌
- [ ] Conflict detection + auto-merge ❌
- [ ] Manual conflict resolution UI ❌
- [x] Read-only offline mode ✅

### Keyboard Shortcuts
- [ ] `Ctrl+Shift+L`: open popup / autofill ❌
- [ ] `/`: focus search ❌
- [ ] `Ctrl+Shift+C`: copy password ❌
- [ ] `Ctrl+Shift+U`: copy username ❌
- [ ] `Ctrl+Shift+K`: lock vault ❌

### Clipboard & Locking
- [x] Copy to clipboard ✅
- [ ] Auto-clear countdown (60s default, configurable) ❌
- [ ] Auto-lock on browser close ❌
- [ ] Idle timeout (5 min default) ❌
- [ ] PIN re-unlock (4-6 digits) ❌

---

## Phase 4: Marketing Site (Week 6-7)

### Astro Static Site (`apps/marketing`)
- [ ] Deploy to Cloudflare Pages (`ironlox.com`) ❌
- [x] Home page — 14-section landing: hero, features grid, how it works, social proof, security deep dive, audit & trust, comparison table, pricing toggle, FAQ, roadmap, CTA + footer ✅
- [x] Features grid — inline on home page (6 cards + comparison table + trust bar + security deep dive) 🔶
- [x] Pricing — inline on home page with monthly/annual toggle ✅
- [ ] Blog ❌
- [ ] Docs/Knowledge Base ❌
- [ ] Download (Chrome + Firefox extension links) ❌
- [x] SEO — meta tags, Open Graph, Twitter Cards, sitemap.xml, robots.txt, structured data (Organization, SoftwareApplication, FAQPage, BreadcrumbList) ✅
- [x] `security.txt` at `.well-known/security.txt` — RFC 9116 compliant ✅
- [x] Privacy policy — 7 sections, dark theme, breadcrumb schema ✅
- [x] Terms of Service — 9 sections, dark theme, breadcrumb schema ✅
- [x] Security policy — 5 sections (vulnerability disclosure, infrastructure security, supply chain) ✅
- [ ] Migration guides: 1Password, Bitwarden, LastPass, Chrome ❌

### Design & Quality
- [x] Dark theme with brand color palette (Plus Jakarta Sans font) ✅
- [x] Scroll-triggered reveal animations (IntersectionObserver) ✅
- [x] Responsive: mobile hamburger nav, responsive grid cards, responsive comparison table ✅
- [x] Accessibility: skip-to-content, aria labels, prefers-reduced-motion, semantic HTML ✅
- [x] Tailwind CSS v4 with custom theme tokens ✅
- [x] Zero JS framework — pure Astro static, inline scripts only for animations + billing toggle ✅

---

## Phase 5: Polish & Launch (Week 8-10)

### Testing
- [x] Crypto: property tests + known vectors (coverage gate not enforced in CI) 🔶
- [ ] API: integration tests (Miniflare + D1/R2 emulation) — test dir exists but empty ❌
- [ ] Web app: Vitest component tests ❌
- [x] E2E: Playwright (3 basic tests in `e2e/auth.spec.ts`) 🔶
- [ ] Extension: Playwright E2E (Chrome + Firefox, top 50 sites) ❌
- [ ] axe-core accessibility audit in CI ❌

### Hardening
- [ ] Rate limiting tuned ❌
- [ ] Turnstile integration verified ❌
- [ ] Argon2id parameters profiled (64MB, 3 iterations baseline) ❌
- [x] CSP headers on all responses ✅
- [x] CORS restricted to known origins ✅
- [ ] Error messages never leak stack traces ❌
- [ ] No secrets or keys in client bundles ❌

### Beta Program
- [ ] Dogfooding ❌
- [ ] Closed beta ❌
- [ ] Open beta ❌

### Extension Store Submission
- [ ] Chrome Web Store ❌
- [ ] Firefox Add-ons ❌

### Launch
- [ ] Monitoring dashboards verified ❌
- [ ] Onboarding email drip activated ❌
- [ ] Support channels live ❌
- [ ] Knowledge base published ❌

---

## Phase 6: Post-Launch (Month 1-3)

All items ❌ — not yet applicable.

---

## v1 Success Metrics (from spec §39)

| Metric | Target |
|--------|--------|
| Signups (first 30 days post-GA) | 1,000 |
| Activation (≥1 password within 48 hours) | 60% |
| Week-4 retention | 40% |
| Critical bug rate | <0.5% |
| Trust tickets | ≤2/week |
| Free → premium conversion (month 3) | 5% |
