# Ironlox Development Roadmap

## Phase 0: Foundation (Week 1-2)

### Monorepo Setup
- [ ] Initialize Turborepo with pnpm workspaces
- [ ] Configure TypeScript base config (`@ironlox/tsconfig`)
- [ ] Configure ESLint + Prettier across all packages
- [ ] Set up Husky pre-commit hooks (lint-staged)

### Shared Packages
- [ ] `packages/crypto` — AES-256-GCM encrypt/decrypt, Argon2id key derivation, TOTP (RFC 6238), envelope encryption
- [ ] `packages/schemas` — Zod schemas for vault data model, API request/response types
- [ ] `packages/autofill` — form detection heuristics, URL matching engine
- [ ] `packages/api-client` — typed Hono RPC client

### CI/CD
- [ ] GitHub Actions: CI pipeline (lint, typecheck, test) on every PR
- [ ] GitHub Actions: Deploy pipeline (deploy worker, deploy web, build extension) on merge to main
- [ ] GitHub Actions: Release pipeline (publish extension) on manual trigger
- [ ] Turborepo remote caching configured

### Crypto Test Suite
- [ ] 100% branch coverage
- [ ] Property-based tests: `decrypt(encrypt(x)) == x`
- [ ] Known-vector tests: AES-GCM (NIST), Argon2id (reference), TOTP (RFC 6238)
- [ ] Constant-time comparison tests

---

## Phase 1: Core Backend (Week 2-4)

### Cloudflare Workers API (`apps/worker`)
- [ ] Hono + Hono RPC setup
- [ ] Hono Zod OpenAPI (auto-generated spec)
- [ ] CORS middleware
- [ ] Error handling middleware

### D1 Database
- [ ] Wrangler migrations setup
- [ ] Schema: `users`, `sessions`, `refresh_tokens`, `mfa`, `recovery_keys`, `login_events`, `rate_limits`
- [ ] Migration CI step

### R2 Blob Storage
- [ ] Bucket setup
- [ ] Object versioning (7-day retention)
- [ ] Signed URL generation for vault/attachment access

### Authentication Endpoints
- [ ] `POST /auth/register` — create account, derive auth hash, store in D1
- [ ] `POST /auth/login` — verify auth hash, issue JWT + refresh token
- [ ] `POST /auth/refresh` — rotate refresh token
- [ ] `POST /auth/mfa/enable` — store TOTP secret
- [ ] `POST /auth/mfa/verify` — verify TOTP during login
- [ ] `POST /auth/mfa/webauthn/register` — passkey registration
- [ ] `POST /auth/mfa/webauthn/verify` — passkey verification
- [ ] `POST /auth/recover` — recovery key login

### Vault Endpoints
- [ ] `GET /vault` — return signed R2 URL + version
- [ ] `PUT /vault` — optimistic locking (version check), upload to R2
- [ ] `GET /vault/attachment/:id` — signed R2 URL
- [ ] `PUT /vault/attachment/:id` — upload attachment (quota check)
- [ ] `DELETE /vault/attachment/:id` — delete attachment

### Account Endpoints
- [ ] `GET /account` — user info, tier, quota, login events
- [ ] `DELETE /account` — soft delete (7-day grace period)
- [ ] `POST /account/undelete` — cancel deletion
- [ ] `PUT /account/password` — re-wrap vault key

### Infrastructure
- [ ] MailChannels integration (email verification, alerts, drip)
- [ ] Stripe webhook handler (subscription create/update/cancel)
- [ ] KV rate limiting (Turnstile trigger + IP cooldown)
- [ ] KV feature flags (kill switches)
- [ ] `GET /health` endpoint
- [ ] Sentry (Workers SDK) error tracking

---

## Phase 2: Web App (Week 4-7)

### React / Next.js Setup (`apps/web`)
- [ ] Next.js (CSR only, no RSC)
- [ ] shadcn/ui + Tailwind CSS
- [ ] Dark gray theme, system dark/light mode toggle
- [ ] Inter + JetBrains Mono fonts
- [ ] Responsive: mobile cards, desktop table
- [ ] Sonner toast notifications
- [ ] Skeleton loading states
- [ ] Empty states with CTAs
- [ ] i18next setup (`en.json`)

### Auth UI
- [ ] Login page (email + master password)
- [ ] Signup page (email + master password + zxcvbn strength meter + HIBP check)
- [ ] MFA setup & verify pages
- [ ] Passkey registration & verify pages
- [ ] Recovery key login page
- [ ] Account deletion confirmation + undelete

### Onboarding Flow
- [ ] 3-option landing: Import / Add first password / Demo vault
- [ ] Recovery key generation with mandatory save acknowledgement
- [ ] Demo vault (3 pre-populated items, one-click clear)

### Vault Browser
- [ ] Vault list/table with search (Fuse.js fuzzy)
- [ ] Category filter (Login, Card, Note, Identity)
- [ ] Tag filter
- [ ] Sort: name, date created, date updated, recently used
- [ ] 5 most recent items pinned
- [ ] Item detail view with masked/unmasked fields
- [ ] Custom fields (text + hidden)
- [ ] Password show/hide toggle (eye icon, 30s auto-hide)

### Add / Edit Items
- [ ] Login form (URIs max 3, username, password, TOTP seed, notes)
- [ ] Credit Card form (cardholder, number, expiry, CVV, brand, notes)
- [ ] Secure Note form (title, content)
- [ ] Identity form (name, email, phone, address, notes)
- [ ] Password generator inline (random + passphrase)
- [ ] Password history (last 5, client-side)
- [ ] Custom fields (add/remove key-value pairs)

### Security Dashboard
- [ ] HIBP breach check
- [ ] Reused password detection
- [ ] Weak password detection (zxcvbn)
- [ ] Password aging (>2 years)
- [ ] 2FA audit (sites with 2FA support)
- [ ] Red/yellow/green score

### Settings
- [ ] Account: email, change email (OTP flow), change master password (re-wrap key)
- [ ] Security: MFA setup/disable, passkeys, recovery key view/regenerate, login history
- [ ] Preferences: vault timeout, clipboard auto-clear duration, dark/light mode
- [ ] Billing: Stripe Customer Portal link, subscription status
- [ ] Danger zone: delete account

### Import / Export
- [ ] CSV import with field-mapping UI
- [ ] CSV template download
- [ ] Plaintext CSV export (with security warning)
- [ ] Password-protected JSON export

### File Attachments
- [ ] Upload (≤25MB per file), download, delete
- [ ] Quota display (free: 250MB, premium: 2GB)
- [ ] Client-side encryption before upload
- [ ] Download + decrypt

---

## Phase 3: Browser Extension (Week 5-8, overlaps Phase 2)

### Plasmo Setup (`apps/extension`)
- [ ] Plasmo project init
- [ ] shadcn/ui components adapted for popup (350x500px)
- [ ] Dark gray theme
- [ ] Manifest V3: `storage`, `activeTab`, `clipboardWrite`, `host_permissions: ["<all_urls>"]`

### Popup UI
- [ ] Locked state: master password or PIN entry
- [ ] Vault list: search + category filter + tag filter
- [ ] 5 recents pinned at top
- [ ] Item detail: view, copy username/password/TOTP, edit
- [ ] Add/Edit item form
- [ ] Password generator (inline popover)
- [ ] Settings panel

### Autofill Engine
- [ ] Form detection: password field heuristic → walk backward for username
- [ ] Domain rule database (top 500 sites)
- [ ] URL matching: host default, base domain, starts with, regex
- [ ] Inline autofill suggestion on login pages
- [ ] Context menu on form fields
- [ ] TOTP auto-fill + clipboard copy

### Sync Client
- [ ] Encrypted vault fetch from R2 (signed URL)
- [ ] Vault decrypt local → IndexedDB cache
- [ ] Optimistic locking: version check before upload
- [ ] Conflict detection + auto-merge (additions/deletions)
- [ ] Manual conflict resolution UI
- [ ] Read-only offline mode

### Keyboard Shortcuts
- [ ] `Ctrl+Shift+L`: open popup / autofill
- [ ] `/`: focus search
- [ ] `Ctrl+Shift+C`: copy password
- [ ] `Ctrl+Shift+U`: copy username
- [ ] `Ctrl+Shift+K`: lock vault

### Clipboard & Locking
- [ ] Copy with auto-clear countdown (60s default, configurable)
- [ ] Auto-lock on browser close
- [ ] Idle timeout (5 min default)
- [ ] PIN re-unlock (4-6 digits)

---

## Phase 4: Marketing Site (Week 6-7)

### Astro Static Site (`apps/marketing`)
- [ ] Deploy to Cloudflare Pages (`ironlox.com`)
- [ ] Pages: Home, Features, Pricing, Blog, Docs/Knowledge Base, Download
- [ ] SEO: meta tags, Open Graph, Twitter cards, sitemap.xml, robots.txt
- [ ] Download links: Chrome Web Store + Firefox Add-ons
- [ ] `security.txt` at `.well-known/security.txt`
- [ ] Privacy policy + Terms of Service pages
- [ ] Migration guides: 1Password, Bitwarden, LastPass, Chrome

---

## Phase 5: Polish & Launch (Week 8-10)

### Testing
- [ ] Crypto: 100% branch coverage + property tests + known vectors
- [ ] API: integration tests (Miniflare + D1/R2 emulation), all endpoints
- [ ] Web app: Vitest component tests + Playwright E2E (critical flows)
- [ ] Extension: Playwright E2E (Chrome + Firefox, top 50 sites)
- [ ] axe-core accessibility audit in CI

### Hardening
- [ ] Rate limiting tuned
- [ ] Turnstile integration verified
- [ ] Argon2id parameters profiled (64MB, 3 iterations baseline)
- [ ] CSP headers on all responses
- [ ] CORS restricted to known origins
- [ ] Error messages never leak stack traces
- [ ] No secrets or keys in client bundles

### Beta Program
- [ ] Week 8-9: Dogfooding (internal team use)
- [ ] Week 9-10: Closed beta (50 users, 1:1 feedback)
- [ ] Week 10-12: Open beta (public, "beta" label)

### Extension Store Submission
- [ ] Chrome Web Store: unlisted for beta, public for GA
- [ ] Firefox Add-ons: self-distributed signed .xpi for beta, public listing for GA
- [ ] Store assets: screenshots, description, privacy policy link, open source link

### Launch
- [ ] Monitoring dashboards verified (Cloudflare Analytics + Sentry + Upptime)
- [ ] Onboarding email drip activated
- [ ] Support channels live (GitHub Discussions, shared inbox)
- [ ] Knowledge base published
- [ ] GA launch: remove beta label, public availability

---

## Phase 6: Post-Launch (Month 1-3)

- [ ] Monitor KPIs against v1 success metrics
- [ ] Bug fixes and performance improvements
- [ ] Community rule contributions (autofill domain rules)
- [ ] Community translations (i18n via Crowdin)
- [ ] Iterate on onboarding based on activation funnel data
- [ ] Evaluate premium conversion → adjust pricing if needed
- [ ] Begin v2 planning (mobile apps, Safari, sharing, external audit)

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
