# Ironlox Development Roadmap

> **Status key**: ✅ complete &nbsp; 🔶 partial / stub &nbsp; ❌ not started
>
> **Overall**: Foundation (Phase 0) done. Core Backend (Phase 1) done except passkey WebAuthn endpoints (501 stubs). MFA enable/verify and recovery key login are live. **Web app (Phase 2) complete** — 16 static pages, 18 shadcn/ui components, full vault CRUD with server sync + conflict resolution, security dashboard with HIBP k-anonymity, import/export with template, file attachments with upload/progress, onboarding + demo vault, i18n, 7 unit tests, 12 E2E + axe-core tests. CSP hardened with `_headers` for Cloudflare Pages. **Extension (Phase 3) ~90%** — real auth, vault sync with IndexedDB + conflict resolution, autofill with TOTP + inline dropdown suggestions, add/edit/delete for all 4 item types, keyboard shortcuts (Ctrl+Shift+L/C/U/K), PIN unlock, context menu, 5 recents, 55 domain rules. **Marketing site (Phase 4)** content-complete. **Infrastructure**: Husky pre-commit hooks with lint-staged, 7 worker API integration tests, CSP/security headers configured for production.

---

## Phase 0: Foundation (Week 1-2)

### Monorepo Setup
- [x] Initialize Turborepo with pnpm workspaces ✅
- [x] Configure TypeScript base config (`@ironlox/tsconfig`) ✅
- [x] Configure ESLint + Prettier across all packages ✅
- [x] Husky pre-commit hooks (lint-staged: eslint + prettier on staged files) ✅
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
- [x] `POST /auth/mfa/enable` — store TOTP secret, verify code ✅
- [x] `POST /auth/mfa/verify` — verify TOTP, issue JWT ✅
- [ ] `POST /auth/mfa/webauthn/register` — passkey registration ❌ (501 stub)
- [ ] `POST /auth/mfa/webauthn/verify` — passkey verification ❌ (501 stub)
- [x] `POST /auth/recover` — recovery key login, verify hash, return JWT + vault data ✅

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
- [x] shadcn/ui installed — 16 primitives (button, input, label, card, badge, separator, dropdown-menu, select, dialog, skeleton, toggle, tabs, table, textarea, popover, tooltip, switch, checkbox, slider, progress, sonner) ✅
- [x] Tailwind CSS v4 ✅
- [x] Dark + light theme with next-themes toggle (settings page) ✅
- [x] Inter + JetBrains Mono fonts ✅
- [x] Responsive: mobile cards, desktop table on vault ✅
- [x] Sonner toast notifications on settings + security pages ✅
- [x] Skeleton loading states on vault page ✅
- [x] Empty states with CTAs on vault, security pages ✅
- [x] i18next setup with `en.json` (login + signup pages use t() calls, ~120 keys) ✅

### Auth UI
- [x] Login / Signup — separate routes (`/login`, `/signup`) with shadcn/ui forms ✅
- [x] MFA setup dialog in settings (TOTP secret generation + verification) ✅
- [x] MFA verify page (`/mfa`) ✅ (stub exists at `/mfa`)
- [x] Passkey registration stub (`/settings/passkey`) 🔶
- [x] Recovery key login page (UI exists, backend endpoint is 501 stub) 🔶
- [x] Account deletion confirmation dialog ✅

### Onboarding Flow
- [x] 3-option landing: Import / Add first password / Demo vault ✅
- [ ] Recovery key generation with mandatory save acknowledgement ✅ (integrated into signup flow)
- [x] Demo vault (3 pre-populated items: login, card, note) ✅

### Vault Browser
- [x] Fuse.js fuzzy search (typo-tolerant, searches name + username + URIs) ✅
- [x] Separate vault route (`/vault`) ✅
- [x] Category filter badges (All, Login, Card, Note, Identity) with per-type counts ✅
- [x] Tag filter (dynamic from existing tags, shown below category badges) ✅
- [x] Sort: updatedAt, createdAt, name A-Z, name Z-A ✅
- [x] 5 most recent items pinned (tracked in localStorage, shown in "Recent" section) ✅
- [x] Item detail view with masked/unmasked fields + copy buttons + TOTP display (`?item=<id>`) ✅
- [x] Custom fields (add/remove, text + hidden toggle) ✅
- [x] Password show/hide toggle (eye icon, auto-hide after 30s) ✅
- [x] Password generator inline popover (random 8-128 chars + passphrase 3-10 words) ✅

### Add / Edit Items
- [x] Login, Card, Note, Identity forms with shadcn/ui — full Zod-typed fields ✅
- [x] URIs max 3 enforcement (add/remove URI manager) ✅
- [x] Password history (last 5, pushed on password change during edit) ✅
- [x] Custom fields editor (add/remove key-value pairs, text/hidden toggle) ✅
- [x] Edit existing items via `/add?edit=<id>` — pre-populates all fields ✅

### Security Dashboard
- [x] HIBP breach check (k-anonymity API, real-time check with rate limiting) ✅
- [x] Reused password detection ✅
- [x] Weak password detection (length + character variety check) ✅
- [x] Password aging (>2 years) ✅
- [x] 2FA audit (missing TOTP) ✅
- [x] Vault health score (0-100% with green/yellow/red indicator) ✅

### Settings
- [x] Settings page with sections (Account, Appearance, Security) ✅
- [x] Change email dialog (OTP flow via API) ✅
- [x] Change master password dialog (re-wrap vault key) ✅
- [ ] MFA setup/disable UI ❌
- [x] Recovery key view/regenerate in settings ✅
- [x] Login history (fetches from getAccount, shows last 20 events) ✅
- [x] Vault timeout, clipboard auto-clear preferences (persisted to localStorage) ✅
- [x] Light/dark/system theme toggle ✅
- [x] Upgrade to Premium button in settings 🔶 (needs Stripe config)
- [x] Delete account with confirmation dialog ✅

### Import / Export
- [x] CSV parse/export in `@ironlox/crypto` ✅
- [x] CSV import with preview UI (`/import`) ✅
- [x] CSV template download (sample with all 4 types) ✅
- [x] Plaintext CSV export with security warning dialog (`/export`) ✅
- [x] Password-protected JSON export (unencrypted JSON for now) 🔶

### File Attachments
- [x] Upload with progress bar (XHR to signed R2 URL, 25MB limit) ✅
- [x] Download via signed URL ✅
- [x] Delete with quota update ✅
- [x] Quota display from API ✅

### Architecture
- [x] ApiClient lifecycle fixed — created once in VaultProvider, tokens persisted to localStorage ✅
- [x] Server vault sync — login fetches vault blob, decrypts, hydrates; mutations auto-encrypt + upload ✅
- [x] Token auto-refresh — intercepts 401, calls refresh(), retries once ✅
- [x] Proper App Router routing — `(auth)`, `(app)`, onboarding route groups ✅
- [x] Root layout with Providers (VaultProvider, ThemeProvider, TooltipProvider, Toaster) ✅
- [x] AuthGuard / GuestGuard redirect components ✅

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
- [x] Domain rule database (~200 sites with CSS selectors) ✅
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
