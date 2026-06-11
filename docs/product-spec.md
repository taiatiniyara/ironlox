# Ironlox Product Specification v1.0

## Overview

Ironlox is a consumer secrets manager — a zero-knowledge password manager for individuals to securely store, organize, and autofill passwords, credit cards, secure notes, and other sensitive information.

## 1. Product Category

Consumer password/secrets manager. Not an infrastructure secrets manager (no machine-to-machine, no dynamic secrets, no service accounts). The target user is an individual managing personal credentials.

## 2. Platform Surfaces (v1)

| Surface | Status | Notes |
|---------|--------|-------|
| Browser extension | **Ship** | Chrome + Firefox. Built with Plasmo. |
| Web app | **Ship** | Full dashboard for vault management. |
| Mobile app (iOS/Android) | v2 | Browser-only at launch. Marketing: "iOS and Android coming soon." |
| Desktop app | v2 | |

## 3. Zero-Knowledge Architecture

- **Encryption/decryption happens client-side only.** The server never sees plaintext.
- The server stores opaque encrypted blobs. It cannot decrypt user data.
- The vault encryption key never leaves the client in plaintext.
- Open-source client + crypto code (MIT license) for independent verification.
- Server API code also open-source (MIT license).

## 4. Encryption Model

### 4.1 Vault Key (Envelope Encryption)

| Component | Detail |
|-----------|--------|
| Vault key | 256-bit random key generated at account creation. Never changes. |
| Vault key encryption | Wrapped using AES-256-GCM with a key derived from the master password via Argon2id. |
| Master password change | Only re-wraps the vault key (a ~Kb operation). Vault contents unchanged. |
| Vault encryption | Monolithic encrypted blob (AES-256-GCM), stored in R2. One blob per user. |
| Per-item encryption | Not in v1. The entire vault is one encrypted blob. |

### 4.2 Key Derivation

- Argon2id with high parameters (64MB memory, 3 iterations).
- Two derivation paths from the same master password (different salts):
  - **Encryption key** — for vault key unwrap. Never leaves the client.
  - **Auth hash** — sent to server for authentication.

### 4.3 Data at Rest

| Component | Storage | Encryption |
|-----------|---------|------------|
| Vault blob | R2 | AES-256-GCM (vault key) |
| Vault key (wrapped) | D1 | AES-256-GCM (master-password-derived key) |
| Auth hash | D1 | Argon2id + salt |
| Recovery key hash | D1 | SHA-256 + salt |
| TOTP seeds | Inside vault blob | Inherits vault encryption |
| File attachments | R2 | AES-256-GCM (vault key) |

## 5. Master Password

### 5.1 Strength Enforcement

- Client-side only (zero-knowledge — server never sees the password).
- zxcvbn minimum score: 3/4 (strong).
- HIBP k-anonymity check against known breaches.
- UI: live strength meter bar.
- No character-class requirements (passphrases acceptable).
- Minimum length: 12 characters.

### 5.2 Recovery

- During onboarding, generate a one-time recovery key (random 32-character string).
- User MUST acknowledge saving it before proceeding (no "skip" button).
- Recovery key is hashed and stored server-side (SHA-256 + salt).
- Recovery key re-derives the vault key.
- Both master password AND recovery key lost = data irretrievably gone.
- Account reset available: nuke vault, start over with same email.

### 5.3 Vault Data Model (Encrypted Blob Schema)

```typescript
interface Vault {
  version: number;
  items: VaultItem[];
}

interface VaultItem {
  id: string;               // UUID v4
  type: "login" | "card" | "note" | "identity";
  name: string;
  tags: string[];
  folderId: string | null;  // Future: nesting. v1 defaults to null (root).
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
  deleted?: boolean;        // Soft delete for conflict resolution
  customFields?: Array<{    // User-defined key-value pairs. Hidden type = masked + copyable.
    name: string;
    value: string;
    type: "text" | "hidden";
  }>;

  fields: LoginFields | CardFields | NoteFields | IdentityFields;
}

interface LoginFields {
  uris?: string[];          // Max 3 URIs. Default match on any.
  username: string;
  password: string;
  previousPasswords?: string[];  // Last 5 passwords. Trimmed on each save.
  totpSecret?: string;
  notes?: string;
}

interface CardFields {
  cardholder: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  brand?: string;
  notes?: string;
}

interface NoteFields {
  content: string;
}

interface IdentityFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}
```

### 5.4 Vault Limits

- Soft limit: 10,000 items.
- Performance warning in UI past 10,000 items (decrypt/sync may degrade).
- No hard block. Monolithic blob scales to ~500KB at 10,000 items.

## 6. Authentication

### 6.1 Primary Auth

- Email + master password hash.
- Auth hash derived from master password (different salt than encryption key).
- Auth hash sent to server over HTTPS.

### 6.2 Session Management

- JWT access tokens (15-minute expiry). Verified at Cloudflare edge.
- Opaque refresh tokens (30-day expiry). Stored in D1.
- Silent refresh in the background.

### 6.3 Multi-Factor Authentication (v1)

- TOTP (authenticator app) + recovery codes.
- Recovery codes are mandatory. Stored as SHA-256 hashes in D1.
- No SMS. WebAuthn/Passkey supported as additional MFA option (v1).
- Passkey gates server-side auth only — vault decryption still requires master password.

### 6.4 Brute-Force Protection

- Cloudflare Turnstile after 3 failed attempts per email.
- IP-based cooldown tracking in Workers KV.
- Aggressive Argon2id parameters (computationally expensive).
- Defense in depth — Turnstile + KV + Argon2id.

### 6.5 Email Change

- Verify new email (OTP sent via MailChannels).
- Re-hash auth hash with new email + master password.
- Invalidate all existing sessions after 5-minute grace period.
- Confirmation email to both old and new addresses.
- Email change does NOT affect vault key (key is derived from master password only).

## 7. Vault Organization

### 7.1 Categories (fixed schemas)

| Category | Fields |
|----------|--------|
| Login | Name, URI, Username, Password, TOTP seed, Notes |
| Credit Card | Name, Cardholder, Number, Expiry, CVV, Brand, Notes |
| Secure Note | Title, Content |
| Identity | Title, Name, Email, Phone, Address, Notes |

### 7.2 Tags

- Free-form tags for cross-category organization.
- Multiple tags per item.

### 7.3 v2 Extensions

- Nested folders. Collections. Custom field types.

## 8. Search

- Client-side fuzzy search using Fuse.js.
- Searches all decrypted vault content in memory.
- Typo-tolerant ("googel" → "Google").
- Works offline (read-only cache).
- No server involvement.

## 9. Password Generation

### 9.1 Random Password

- Configurable length (8-128, default 20).
- Toggles: uppercase, lowercase, numbers, symbols.
- Per-site policy not in v1.

### 9.2 Passphrase

- Generate memorable passphrases (e.g., "correct-horse-battery-staple").
- Configurable word count (3-10, default 4).
- Configurable separator (hyphen, space, period, none).

### 9.3 Password History

- Keep last 5 passwords per login item.
- `previousPasswords: string[]` field in `LoginFields`.
- Client-side: push old password into array, trim to 5 on each save.
- Prevent lockout if site password change partially fails.

## 10. Built-in TOTP Generator

- Store TOTP seed alongside login secrets (inside vault).
- Auto-fill: username → password → TOTP code → submit.
- RFC 6238 compliant.
- QR code scanning for seed setup.
- Premium-tier feature.

## 11. Autofill

### 11.1 Form Detection

- Heuristic-first: detect password fields, walk backward to find username.
- Per-domain rule database for top 500 websites.
- Community-contributed rules (open-source).
- No ML in v1.

### 11.2 URL Matching

Default: exact hostname match.

Configurable match detection per login:
- **Host** (default) — exact hostname match.
- **Base domain** — matches all subdomains.
- **Starts with** — prefix match.
- **Regular expression** — for power users.

### 11.3 Autofill Flow

- Extension icon badge shows match count for current page.
- Click extension → select login → auto-fill.
- Keyboard shortcut: `Ctrl+Shift+L` (configurable).
- `/` key focuses search bar in extension popup.
- `Ctrl+Shift+C` copy password, `Ctrl+Shift+U` copy username.
- `Ctrl+Shift+K` lock vault.
- Inline context menu on form fields.
- TOTP code automatically copied to clipboard after fill.

### 11.4 Recent Items

- 5 most recently used items tracked in extension local storage (client-only, not in vault).
- Shown at top of popup in a collapsible "Recent" section.
- Saves scrolling friction for daily-use items.

## 12. Sync

### 12.1 Model

- Cloud-hosted vault with read-only offline cache.
- Monolithic vault blob per user in R2.
- D1 stores metadata (user ID, vault version, wrapped key, auth data).

### 12.2 Conflict Resolution

- Optimistic locking with version number.
- Client sends "I'm updating from version N."
- Server rejects if current version > N. Client pulls latest and merges.
- Auto-merge: union of non-conflicting additions/deletions.
- Manual resolution UI for same-item conflicts.
- Explicit "Sync" button — no background sync surprises.

### 12.3 Offline Access

- Read-only: encrypted vault cached in IndexedDB.
- Unlock with master password offline → view and copy passwords.
- Add/edit/delete requires connection ("You're offline — changes will wait.").
- Full offline write in v2.

## 13. Import & Export

### 13.1 Import (v1)

- CSV only (covers all competitors + Chrome export).
- CSV template provided.
- Field-mapping UI.

### 13.2 Export (v1)

- Plaintext CSV (with loud security warning).
- Password-protected JSON (encrypted with user-chosen password, not master password).

## 14. File Attachments

- Premium-tier feature.
- Per-file max: 25MB.
- Free tier total: 250MB.
- Paid tier total: 2GB.
- Client-side AES-256-GCM encryption with vault key.
- Stored in R2.
- No server-side plaintext access.

## 15. Vault Health Dashboard

Premium-tier feature. All client-side computation.

- **Breach check** — HIBP k-anonymity API.
- **Reused password detection** — scan vault for duplicates.
- **Weak password detection** — zxcvbn on every stored password.
- **Aging report** — passwords unchanged >2 years.
- **2FA audit** — sites supporting 2FA where user hasn't enabled it.
- UI: Security Dashboard with red/yellow/green score.

## 16. Vault Locking

### 16.1 Auto-Lock

- Lock on browser close (extension).
- Configurable idle timeout: 1 min / 5 min (default) / 15 min / 1 hour.
- "Never" is not an option.

### 16.2 PIN Re-Unlock

- 4-6 digit PIN for quick re-unlock after timeout.
- Vault key stays in memory (Web Worker), behind PIN gate.
- Master password required for first unlock or full lock.
- WebAuthn/biometric re-unlock in v2.

## 17. Clipboard Management

- Copy button available (behind "..." menu — autofill is primary).
- Auto-clear after 60 seconds (default).
- Configurable: 30s / 60s / 2min / Never.
- Countdown timer in extension popup.

## 18. UI / Design

### 18.1 Branding

- **Name**: Ironlox.
- **Visual direction**: minimalist/neutral, typography-first.
- **Color palette**: dark gray base + dark surface + single accent color. Polished dark gray theme.
- **Typography**: Inter (UI) + JetBrains Mono (code/passwords).
- **Logo**: icon mark + wordmark.
- **Tone**: serious about security, simple to use. No cartoon mascots.

### 18.2 Design System

- shadcn/ui + Tailwind CSS.
- Accessible primitives via Radix.
- Consistent theme across extension popup and web app.

### 18.3 Dark Mode

- Both light and dark themes.
- Default follows system `prefers-color-scheme`.
- Manual toggle in settings.
- Tailwind `dark:` variant + shadcn/ui built-in support.

### 18.4 Screen Inventory

**Extension Popup (350x500px)**

| Screen | Description |
|--------|-------------|
| Locked state | Enter master password or PIN |
| Vault list | Scrollable list, search bar, category filter, tags |
| Item detail | View secret with copy buttons, TOTP code |
| Add/Edit item | Form per category type |
| Password generator | Popover or inline |
| Autofill suggestion | Inline dropdown on login page |
| Settings | Small inline panel |

**Web App (Full Dashboard)**

| Screen | Description |
|--------|-------------|
| Login / Signup / MFA | Auth flow |
| Onboarding | Import, add first password, demo vault |
| Vault browser | Full table/list view |
| Item detail | Expanded view |
| Add/Edit item | Full form |
| Security dashboard | Vault health reports |
| Settings | Account, security, preferences, billing |
| Import/Export | CSV/JSON import and export |
| File attachments | Attachment manager (premium) |
| Recovery key | View/regenerate recovery key |

### 18.5 Accessibility

- WCAG 2.1 AA target.
- shadcn/ui primitives (Radix) provide accessible base components.
- axe-core automated audit in Playwright E2E pipeline.
- CI fails on critical a11y violations.
- Manual screen reader testing on critical flows: signup, login, add password, autofill.
- Extension: keyboard navigation is the primary concern (popup overlay).

### 18.6 Loading & Empty States

- **Loading**: shadcn/ui skeletons for web app lists. Spinner for extension popup.
- **Empty vault**: "No passwords yet" + "Add your first password" CTA + "Import" link.
- **Empty search**: "No results" with suggestion to broaden search or add new.
- **Empty category**: "No [logins/cards/notes] yet" with add CTA.
- **Sync indicator**: subtle spinning icon + "Last synced X min ago" text. Never blocking.
- **Offline indicator**: red badge in extension. "You're offline. Read-only."

### 18.7 UX Components

- **Password show/hide**: eye/eye-off icon button on every password field. Auto-hides after 30s or on blur.
- **Sort options**: Name (A-Z, Z-A), date created, date updated, recently used. Default: recently updated.
- **Notification toasts**: shadcn/ui Sonner. Success/error/info. Top-right (web app), bottom (extension popup).
- **Responsive breakpoints**: Tailwind defaults. Mobile (<768px) cards, desktop (>1024px) table. Settings sidebar → tabs on mobile.

### 18.8 Icons & Assets

- Extension icons: 16x16, 32x32, 48x48, 128x128. Toolbar icon with count badge.
- Web app: favicon.ico, apple-touch-icon, PWA manifest.
- Marketing site: Open Graph image (1200x630), Twitter card image.
- All sizes generated from single SVG/PNG source via CI script.

### 18.9 Marketing Site

- Separate Astro static site at `ironlox.com` (Cloudflare Pages — deployment pending).
- Pages implemented: Home (14-section landing with hero, features grid, how it works, social proof, security deep dive, audit & trust, comparison table, pricing toggle, FAQ, roadmap, CTA + footer), Privacy (7 sections), Terms of Service (9 sections), Security (5 sections: vulnerability disclosure, infrastructure security, supply chain).
- Pages pending: Blog, Docs/Knowledge Base, Download (Chrome + Firefox links), Migration guides.
- SEO complete: meta tags, Open Graph, Twitter Cards, sitemap.xml, robots.txt, structured data (Organization, SoftwareApplication, FAQPage, BreadcrumbList).
- `.well-known/security.txt` deployed — RFC 9116 compliant.
- Design: dark theme, Plus Jakarta Sans font, Tailwind CSS v4 with custom tokens, scroll-triggered reveal animations, responsive (mobile hamburger nav, responsive grids, responsive comparison table), accessible (skip-to-content, aria labels, prefers-reduced-motion, semantic HTML). Zero JS framework — pure Astro static output.
- Web app at `app.ironlox.com`.
- API at `api.ironlox.com`.

## 19. Account Lifecycle

### 19.1 Onboarding

- Three-option landing after account creation:
  1. "Import from another password manager" → CSV upload flow.
  2. "Add your first password manually" → guided form.
  3. "Try the demo" → pre-populated sample vault (3 items). Clearable with one click.
- Recovery key generation with mandatory save acknowledgement.

### 19.2 Deletion

- Soft delete with 7-day grace period.
- Email notification: "Your account will be permanently deleted in 7 days. Log in to cancel."
- After grace period: hard delete (R2, D1, KV all wiped).
- Data export offered during grace period.

## 20. Pricing

### 20.1 Tiers

| Feature | Free | Premium ($3/month or $30/year) |
|---------|------|-------------------------------|
| Unlimited passwords | Yes | Yes |
| Unlimited devices | Yes | Yes |
| Autofill | Yes | Yes |
| Password generator | Yes | Yes |
| TOTP 2FA codes | No | Yes |
| File attachments | 250MB | 2GB |
| Vault health reports | No | Yes |
| Priority support | No | Yes |

### 20.2 Future

- Family plan (vault sharing).

## 21. Sharing Model

- No sharing in v1. Single-user vault only.
- v2 candidate: "Send" (one-time link, no recipient account required).

## 22. Tech Stack

### 22.1 Architecture

| Component | Technology |
|-----------|-----------|
| Browser extension | Plasmo (React-based) |
| Web app | React / Next.js (CSR only) |
| API server | Cloudflare Workers (TypeScript) |
| Framework | Hono + Hono RPC |
| Database | Cloudflare D1 (SQLite-compatible) |
| Blob storage | Cloudflare R2 |
| KV store | Cloudflare Workers KV (rate limits, sessions) |
| Auth | JWT + opaque refresh tokens |
| Package manager | pnpm + Turborepo monorepo |

### 22.2 Monorepo Structure

```
ironlox/
├── apps/
│   ├── extension/    # Plasmo browser extension
│   ├── web/          # React/Next.js dashboard
│   ├── worker/       # Cloudflare Workers API
│   └── marketing/    # Astro static site
├── packages/
│   ├── crypto/       # Encryption, key derivation, TOTP
│   ├── schemas/      # Zod schemas, shared types
│   ├── autofill/     # Form detection, URL matching
│   ├── api-client/   # Typed HTTP client (Hono RPC planned)
│   └── tsconfig/     # Shared TypeScript base config
└── docs/
```

- **Graphify** — knowledge graph tool for dependency/architecture visualization. Run `pnpm run graphify` to generate an interactive graph of the monorepo (nodes = source files/concepts, edges = imports/calls/references). Output in `graphify-out/`.

### 22.3 API Design

- Hono + Hono RPC for end-to-end type safety.
- REST-style endpoints (GET /vault, PUT /vault).
- All endpoints behind JWT auth.
- No server-side vault decryption.

### 22.4 API Endpoint Inventory

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST   | /auth/register         | No  | Create account |
| POST   | /auth/login            | No  | Login, get JWT + refresh token |
| POST   | /auth/refresh          | No  | Rotate refresh token |
| POST   | /auth/mfa/enable       | JWT | Enable TOTP |
| POST   | /auth/mfa/verify       | No  | Verify TOTP during login |
| POST   | /auth/mfa/webauthn/register | JWT | Register passkey as MFA |
| POST   | /auth/mfa/webauthn/verify   | No  | Verify passkey during login |
| POST   | /auth/recover          | No  | Recovery key login |
| GET    | /vault                 | JWT | Get vault (R2 blob URL + version) |
| PUT    | /vault                 | JWT | Upload new vault blob |
| GET    | /vault/attachment/:id  | JWT | Get attachment (R2 blob URL) |
| PUT    | /vault/attachment/:id  | JWT | Upload attachment |
| DELETE | /vault/attachment/:id  | JWT | Delete attachment |
| GET    | /account               | JWT | Account info, tier, quota |
| DELETE | /account               | JWT | Initiate account deletion |
| POST   | /account/undelete      | No  | Cancel deletion (grace period) |
| PUT    | /account/password      | JWT | Change master password (re-wrap key) |
| GET    | /health                | No  | Health check |

All routes generated from Hono + Zod schemas. OpenAPI 3.1 spec auto-generated.

## 23. Browser Support (v1)

| Browser | Support |
|---------|---------|
| Chrome | Yes |
| Firefox | Yes |
| Safari | v2 |
| Edge/Brave/Arc | Via Chrome Web Store |

## 24. Privacy & Trust

### 24.1 Analytics

- No client-side analytics library.
- Server-side metrics only (Workers Analytics Engine + D1 query stats).
- Opt-in crash reporting with aggressive PII scrubbing.

### 24.2 Open Source

- Client (extension + web app + crypto) — MIT license.
- Server (Workers API) — MIT license.
- Security whitepaper explaining encryption model.
- External audit on v2 roadmap.

### 24.3 Self-Hosting

- Not supported in v1 (Workers/D1/R2 stack makes it impractical).
- Community server (Docker + SQLite + S3) considered for v2 if demand warrants.

## 25. Internationalization

- English only for v1.
- All UI strings externalized into `i18next` translation files (`en.json`) from day one.
- Community-contributed translations via Crowdin post-launch.

## 26. Rate Limiting & Abuse Prevention

- Cloudflare Turnstile after 3 failed auth attempts per email.
- IP-based cooldown in Workers KV.
- Argon2id configured with high memory/cost parameters.
- Rate limits on all sensitive endpoints (login, signup, vault upload).

## 27. Error Handling

Error taxonomy with user-friendly messages:

| Category | Example |
|----------|---------|
| Transient | "Connection lost. Retrying..." (network errors) |
| Client-fixable | "A newer version of your vault exists on the server. Sync now?" (version conflicts) |
| Critical | "Unable to unlock your vault. If you recently changed your master password on another device, please re-enter it. Otherwise, try your recovery key." |

- No raw stack traces in production.
- Always provide a next action.
- Recovery key path always surfaced as fallback.

## 28. Testing Strategy

| Layer | Approach | Bar |
|-------|----------|-----|
| Crypto | Unit tests + property-based tests + known vectors | 100% branch coverage |
| API | Integration tests (Miniflare + D1/R2 emulation) | All endpoints covered |
| Extension | E2E (Playwright + Chrome extension testing) | Critical user journeys |
| Web app | Component tests (Vitest) + E2E (Playwright) | Critical user journeys |

- Crypto is the non-negotiable layer. Property-based: `decrypt(encrypt(x)) == x` for all `x`.
- RFC test vectors for TOTP (RFC 6238).
- NIST test vectors for AES-GCM.
- Argon2 test vectors.
- Fuzz testing for CSV import parsers.

## 29. Error Codes & Versioning

Notable error codes:

| Code | Meaning |
|------|---------|
| `VAULT_VERSION_CONFLICT` | Sync conflict — pull latest first |
| `VAULT_DECRYPT_FAILED` | Local decryption failed — try re-entering master password or recovery key |
| `RATE_LIMITED` | Too many attempts — wait or solve Turnstile |
| `SESSION_EXPIRED` | JWT expired — silent refresh or re-login |
| `STORAGE_QUOTA_EXCEEDED` | R2 attachment quota reached |
| `IMPORT_PARSE_ERROR` | CSV import could not be parsed |

## 30. Email (Transactional)

- Cloudflare Workers → MailChannels integration.
- DKIM/SPF configured on `ironlox.com`.
- Email verification on signup (required).
- New device login alerts.
- Account deletion grace period notification.
- Minimal: ~4 email templates total.

## 31. Payments

- Stripe (Checkout + Customer Portal + webhooks).
- Workers handle Stripe webhooks, D1 stores subscription state.
- Stripe Tax for VAT/GST compliance.
- Premium tier: $3/month or $30/year.

## 32. CI/CD

- GitHub Actions + Turborepo remote caching.
- Three pipelines:
  1. **CI** (every PR): lint, typecheck, test crypto + schemas + API.
  2. **Deploy** (merge to main): `wrangler deploy` API, deploy web to Cloudflare Pages, build extension artifacts.
  3. **Release** (manual trigger): publish extension to Chrome Web Store + Firefox Add-ons.
- Cloudflare Pages for web app (auto-deploy on push).
- Preview environments per PR (Pages preview URL for web, `wrangler dev` for API).

## 33. Monitoring & Alerting

- Cloudflare Analytics Engine: throughput, error rates, duration (built-in, free).
- Sentry (Workers SDK): error tracking, stack traces, alerting.
- Upptime: open-source external health checks (`GET /health`) via GitHub Actions, free.
- Slack webhook for critical alerts (auth failure spike, D1 error threshold breach).

## 34. Database Migrations (D1)

- Wrangler migrations (`wrangler d1 migrations apply`) in CI before deploy.
- Migrations kept small and additive (backwards-compatible).
- No programmatic migrations at Worker startup.

## 35. Legal

- Privacy policy + Terms of Service via Termly/Avodocs template, customized for zero-knowledge model.
- Key clauses: data we collect (email, vault metadata), data we never see (vault contents, master password, plaintext secrets), law enforcement handling (canary + transparency report).
- **Content safety**: We cannot scan encrypted vaults. We comply with valid legal process for metadata we possess (email, timestamps, IP hashes). Accounts will be terminated on credible report of illegal activity. Abuse contact: `abuse@ironlox.com`.
- 1-hour lawyer review before public launch if budget allows.

### 35.1 Security Disclosure

- `security.txt` at `ironlox.com/.well-known/security.txt` (RFC 9116).
- `security@ironlox.com` for vulnerability reports.
- 90-day disclosure policy.
- Public Hall of Fame page for credited researchers.
- No paid bounty in v1 (budget).

## 36. Support System

- GitHub Discussions for community support.
- Docusaurus/Starlight knowledge base deployed to Cloudflare Pages (static, free).
- Paid tier: priority GitHub label + email support (shared inbox).
- No live chat, no help desk SaaS in v1.

## 37. Onboarding Email Drip

All emails via MailChannels. Drip sequence:

| Day | Email |
|-----|-------|
| 0 | Verify your email (transactional, required) |
| 0 | Welcome + "Set up autofill in 60 seconds" |
| 1 | "Here's how to migrate your passwords" (import flow) |
| 3 | "Two things: try the password generator + access on another device" |
| 7 | "Check your vault health" (premium upsell) |
| 14 | "You haven't set up MFA yet" (if MFA not enabled) |
| 30 | "We miss you" re-engagement (if inactive) |

## 38. Migration Guides

Published in docs/knowledge base. Per-competitor walkthrough with screenshots:

1. Bitwarden → Ironlox
2. 1Password → Ironlox
3. LastPass → Ironlox
4. Chrome Password Manager → Ironlox

Each guide: export instructions + CSV field mapping table + import walkthrough.

## 39. v1 Success Metrics

| Metric | Target |
|--------|--------|
| Signups (first 30 days post-GA) | 1,000 |
| Activation (≥1 password within 48 hours) | 60% |
| Week-4 retention | 40% |
| Critical bug rate | <0.5% (decryption failures, sync loss) |
| Trust tickets ("is my data safe?") | ≤2/week |
| Free → premium conversion (month 3) | 5% |

## 40. Beta Program

1. **Dogfooding** (2 weeks): internal use only.
2. **Closed beta** (50 users, 4 weeks): invite-only, 1:1 feedback calls.
3. **Open beta** (public, "beta" label, 4-8 weeks): public signup, automated feedback.
4. **GA launch**: remove beta label, full availability.
- Beta builds nightly via CI.
- Closed beta tests: recovery key flow, multi-device sync, import, top-100 site autofill.

## 41. Backup & Disaster Recovery

- R2: object versioning enabled, 7-day version retention.
- D1: built-in point-in-time restore via WAL.
- No explicit backup cron Worker needed.
- Auth data is reconstructable (users re-register). Vault blobs are encrypted and durable.
- Lost master password = irretrievable data (by design).

## 42. Cookie Consent

- No cookie banner.
- No tracking cookies exist.
- Auth JWTs are strictly necessary (GDPR exemption).
- No third-party scripts on the web app.
- Stated clearly in privacy policy.

## 43. Extension Store Submission

- Chrome Web Store ($5 one-time developer fee) + Firefox Add-ons (free).
- Minimum permissions: `storage`, `activeTab`, `clipboardWrite`, `host_permissions: ["<all_urls>"]`.
- Open source link in store listings.
- Beta: "unlisted" on Chrome, self-distributed signed `.xpi` on Firefox.
- Submit 1-2 weeks before launch (3-5 day review Chrome, 1-3 day Firefox).

## 44. Security Event Log (User-Visible)

- D1 table: `login_events(user_id, timestamp, ip_hash, user_agent, city_country)`.
- Show last 20 logins in account settings.
- Email alert on login from new device (new IP + user-agent combo).
- IP addresses stored hashed (SHA-256). No raw IPs.

## 45. Feature Flags

Three-layer config:
1. **KV**: runtime feature kill switches (instant toggle, ~60s global propagation).
2. **D1**: per-user tier/state (free vs. premium).
3. **Environment variables**: deploy-time config (API keys, secrets, thresholds).
- Free users see premium features with upgrade CTA (in-app upselling).

## Appendix A: Dependency Map

Decision dependencies across sections:

```
Encryption model (4) → Sharing model (21) ← wait for v2
Encryption model (4) → Vault key (4.1) → Master password change
Encryption model (4) → File attachments (14)
Auth model (6) → Session management (6.2)
Tech stack (22) → Self-hosting decision (24.3) ← Workers makes it impractical
Tech stack (22) → API design (22.3) → Hono RPC
Tech stack (22) → Monorepo structure (22.2) → Shared packages
Pricing (20) → TOTP generator (10), File attachments (14), Vault health (15)
Sync model (12) → Offline support (12.3) → Read-only cache
Recovery key (5.2) → Account lifecycle (19)
Email (30) → MailChannels delivery
Payments (31) → Stripe webhooks → D1 subscription state
CI/CD (32) → GitHub Actions → CLoudflare Pages + Workers deploy
Feature flags (42) → KV kill switches + D1 tier + Env vars config
```

## Appendix B: v2 Candidate Features

- Mobile apps (iOS/Android)
- Safari extension
- WebAuthn/Passkey support
- Emergency access (trusted contact)
- Full offline write
- Per-secret encryption + sharing
- Send (one-time share link)
- Community self-host server
- External security audit
- Per-site password policy for generator
- Custom field types
- Nested folders / collections
