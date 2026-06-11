# Ironlox Web App — Phase 2 Improvement Plan

> **Goal**: Transform the single-file prototype into a production-ready Next.js dashboard at `app.ironlox.com`.
>
> **Current state**: Single `page.tsx` (~500 lines). No routing, no shadcn/ui, no server sync, api client lifecycle broken, i18n unused, settings non-functional.
>
> **Reference**: `docs/product-spec.md` §18.4 (web app screen inventory), `docs/roadmap.md` Phase 2 checklist.

---

## 0. Emergency Fixes (Week 1 — before anything else)

These are correctness-critical bugs that must ship before any feature work.

### 0.1 Fix API Client Lifecycle
- **Problem**: `createApiClient` is called inside `AuthScreen` component — after auth, the client instance is garbage-collected and vault operations have no client.
- **Fix**: Move `ApiClient` into `VaultProvider` context. Create it once on mount (lazy, after first auth). Expose via context alongside auth/vault state.
- **Impact**: Unblocks server sync, token refresh, and all authenticated API calls.

### 0.2 Token Persistence
- **Problem**: `accessToken` and `refreshToken` live only in React state — lost on page refresh.
- **Fix**: Persist both tokens in `localStorage`. Restore on mount. Clear on logout.
- **Impact**: Users stay logged in across refreshes. Required for production UX.

### 0.3 Vault Server Sync
- **Problem**: Vault data is created/saved in-memory only. Never fetched from or pushed to server. Lost on refresh.
- **Fix**: On login, call `apiClient.getVault()` → decrypt → hydrate state. On vault mutation, call `apiClient.putVault(encryptedBlob, version)`. Respect version conflict (409 → pull latest → merge → retry).
- **Impact**: Vault survives page refresh. Multi-device sync works. This is the core product.

### 0.4 Token Auto-Refresh
- **Problem**: 15-min JWT expiry with no refresh mechanism. User gets logged out silently.
- **Fix**: Intercept 401 responses in `ApiClient`, call `refresh()`, retry original request. Persist new token pair.
- **Impact**: Sessions survive beyond 15 minutes.

---

## 1. Architecture Restructure (Week 1)

### 1.1 Routing

Break the single-page app into proper App Router routes:

```
src/app/
├── layout.tsx              # Root layout: providers, theme, fonts
├── globals.css             # Tailwind v4 + shadcn/ui theme
├── page.tsx                # Redirect: /auth if not logged in, /vault if logged in
├── (auth)/                 # Route group (no layout chrome)
│   ├── layout.tsx          # Centered card layout (minimal)
│   ├── login/page.tsx      # Login form
│   ├── signup/page.tsx     # Signup form (with password strength + recovery key gen)
│   ├── mfa/page.tsx        # TOTP verify (post-login)
│   └── recover/page.tsx    # Recovery key login
├── (app)/                  # Route group (with sidebar layout)
│   ├── layout.tsx          # Sidebar + topbar + main content area
│   ├── vault/
│   │   ├── page.tsx        # Vault list (default view)
│   │   └── [itemId]/
│   │       ├── page.tsx    # Item detail view
│   │       └── edit/page.tsx  # Edit item form
│   ├── add/page.tsx        # Add item form (or modal)
│   ├── security/page.tsx   # Security dashboard / vault health
│   ├── settings/
│   │   ├── page.tsx        # General settings
│   │   ├── account/page.tsx   # Account management (email, password, delete)
│   │   └── billing/page.tsx   # Stripe portal link, tier info
│   ├── import/page.tsx     # CSV import with field mapping
│   ├── export/page.tsx     # CSV/JSON export
│   └── attachments/page.tsx   # File attachment manager
└── onboarding/
    ├── layout.tsx          # Progressive onboarding flow (no sidebar)
    ├── welcome/page.tsx    # 3-option landing (Import / Add first / Demo)
    └── recovery-key/page.tsx   # Mandatory recovery key acknowledgement
```

### 1.2 Component Tree (per route)

| Route | Components |
|-------|-----------|
| Login | LoginForm, PasswordInput (show/hide eye), SubmitButton (loading) |
| Signup | SignupForm, PasswordStrengthMeter, PasswordInput, RecoveryKeyDisplay, SubmitButton |
| MFA | MfaVerificationForm (6-digit input) |
| Recover | RecoveryKeyForm |
| Onboarding Welcome | WelcomeCard (3 options: ImportCard, AddFirstCard, DemoCard) |
| Onboarding RecoveryKey | RecoveryKeyMandatorySave (no skip button allowed) |
| Vault List | VaultToolbar (search + category filter + sort + add button), VaultList (Fuse.js), VaultItemCard/VaultItemRow, PinnedRecentSection, EmptyVaultCTA |
| Item Detail | ItemHeader, PasswordDisplay, TOTPDisplay, FieldList, CustomFields, CopyButton, EditButton, DeleteButton |
| Add/Edit Item | ItemForm (per-type), CategorySelector, URIManager (max 3), PasswordGenerator (inline popover), CustomFieldEditor, NotesEditor |
| Security Dashboard | VaultHealthScore, BreachCheckList, ReusedPasswordList, WeakPasswordList, AgingReport, TwoFactorAudit |
| Settings | SettingsSidebar, AccountSection, SecuritySection, PreferencesSection, BillingSection |
| Import | CSVUploader, FieldMappingTable, MappingPreview, ImportButton |
| Export | ExportTypeSelector, SecurityWarningDialog, DownloadButton |

### 1.3 Shared Layout Components

```
src/components/
├── ui/                     # shadcn/ui primitives (auto-generated)
├── layout/
│   ├── app-layout.tsx      # (app) route group layout: sidebar + topbar
│   ├── sidebar.tsx         # Navigation: Vault, Security, Import/Export, Attachments, Settings
│   ├── topbar.tsx          # Search bar (global), user menu, lock button
│   └── auth-layout.tsx     # (auth) route group layout: centered card
├── vault/
│   ├── vault-toolbar.tsx
│   ├── vault-list.tsx
│   ├── vault-item-card.tsx
│   ├── vault-item-row.tsx
│   ├── item-detail.tsx
│   ├── item-form.tsx
│   ├── category-selector.tsx
│   ├── uri-manager.tsx
│   ├── password-generator.tsx
│   ├── password-input.tsx
│   ├── totp-display.tsx
│   └── custom-fields-editor.tsx
├── auth/
│   ├── login-form.tsx
│   ├── signup-form.tsx
│   ├── password-strength-meter.tsx
│   ├── recovery-key-display.tsx
│   ├── mfa-verification.tsx
│   └── auth-guard.tsx       # Route protection wrapper
├── onboarding/
│   ├── welcome-card.tsx
│   └── recovery-key-save.tsx
├── security/
│   ├── vault-health-score.tsx
│   ├── breach-check-list.tsx
│   ├── reused-password-list.tsx
│   ├── weak-password-list.tsx
│   ├── aging-report.tsx
│   └── two-factor-audit.tsx
├── settings/
│   ├── account-section.tsx
│   ├── security-section.tsx
│   ├── preferences-section.tsx
│   └── billing-section.tsx
├── import-export/
│   ├── csv-uploader.tsx
│   ├── field-mapping-table.tsx
│   └── export-downloader.tsx
├── attachments/
│   ├── attachment-list.tsx
│   └── quota-display.tsx
└── shared/
    ├── empty-state.tsx      # Reusable empty state with CTA
    ├── skeleton.tsx         # Loading skeletons (or use shadcn/ui)
    ├── offline-badge.tsx
    ├── sync-indicator.tsx
    └── copy-button.tsx      # With clipboard auto-clear countdown
```

---

## 2. shadcn/ui Migration (Week 1)

### 2.1 Installation
```bash
pnpx shadcn@latest init --cwd apps/web --src-dir src
# Answer: TypeScript, Tailwind v4, CSS variables, neutral base, zinc accent
```

### 2.2 Components to Add (in dependency order)
```
button → input → label → card → form
badge → separator → dropdown-menu → select
dialog → sheet → popover → tooltip
table → tabs → skeleton → toast (replace direct sonner import)
toggle → switch → slider → progress
avatar → breadcrumb → command (search palette)
```

### 2.3 Migration Strategy
1. Create all shadcn/ui primitives in `src/components/ui/`
2. `cn()` utility from shadcn in `src/lib/utils.ts`
3. Rewrite components one at a time: replace raw `<button>` → `<Button>`, raw `<input>` → `<Input>`, raw `<select>` → `<Select>`
4. Convert `globals.css` to shadcn/ui CSS variable format (merge existing dark theme tokens)
5. Install ThemeProvider (next-themes) for light/dark toggle

---

## 3. State Management (Week 1)

### 3.1 Refactored VaultProvider

Move from single-file context to structured state management:

```
src/lib/
├── vault-context.tsx       # Auth state + vault state + api client
├── vault-reducer.ts        # Vault CRUD operations (pure functions)
├── sync-engine.ts          # getVault/putVault with version tracking + conflict handling
├── storage.ts              # localStorage abstraction (tokens, preferences)
└── utils.ts                # cn() from shadcn/ui
```

### 3.2 State Shape

```typescript
interface AppState {
  // Auth
  isAuthenticated: boolean;
  isOnboarded: boolean;
  email: string;
  apiClient: ApiClient | null;

  // Vault
  vault: Vault | null;
  vaultVersion: number;
  isVaultLoaded: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;

  // UI
  preferences: {
    vaultTimeout: number;
    clipboardClearTimeout: number;
    theme: "light" | "dark" | "system";
  };
}
```

### 3.3 Data Flow

```
Login/Signup
  → derive authHash (crypto)
  → apiClient.login(email, authHash)
  → receive JWT + refreshToken
  → store tokens in localStorage
  → apiClient.getVault()
  → decrypt vault blob (crypto)
  → hydrate vault state

Vault Mutation
  → update local state
  → encrypt vault blob (crypto)
  → apiClient.putVault(encryptedBlob, version)
  → on 409: pull latest, merge, retry
  → update version + lastSyncedAt

Logout
  → apiClient.revoke()
  → clear localStorage
  → clear vault state
  → redirect to /login
```

---

## 4. Feature Implementation Order (Week 2-7)

Ordered by dependency: foundational → core → premium → polish.

### Phase 2a: Auth + Routing (Week 2)

| # | Task | Depends On |
|---|------|-----------|
| 1 | Install shadcn/ui primitives | — |
| 2 | Create route scaffold (all pages as stubs) | 0.1, 1.1 |
| 3 | Implement AuthGuard (redirect if not authenticated) | 0.1, 0.2 |
| 4 | Login page with i18n + shadcn/ui | 2.3, 4.3 |
| 5 | Signup page with zxcvbn strength meter + HIBP check | 2.3, 4.4 |
| 6 | Onboarding welcome (3-option landing) | 4.4 |
| 7 | Recovery key generation + mandatory save | 4.4, 0.3 |
| 8 | MFA verify page | — |
| 9 | Recovery key login page | 4.5 |
| 10 | Token refresh + 401 interception | 0.1, 0.4 |

### Phase 2b: Vault Core (Week 3)

| # | Task | Depends On |
|---|------|-----------|
| 11 | Vault server sync (getVault + putVault + conflict handling) | 0.1, 0.3, 3.2 |
| 12 | Vault list view (Fuse.js search) | 3.2, 4.6 |
| 13 | Category filter (Login, Card, Note, Identity) | 4.6 |
| 14 | Sort options (name, date created, date updated, recently used) | 4.6 |
| 15 | Vault item card component (responsive cards for mobile) | 4.6 |
| 16 | Vault item row component (table for desktop) | 4.6 |
| 17 | Empty state with CTA ("Add your first password") | 4.6 |
| 18 | Skeleton loading states (vault list, item detail) | 4.6 |

### Phase 2c: Vault Detail + Add/Edit (Week 4)

| # | Task | Depends On |
|---|------|-----------|
| 19 | Item detail view (all fields, masked/unmasked) | 3.2 |
| 20 | Password show/hide toggle (eye icon, auto-hide after 30s) | 5.7 |
| 21 | Copy-to-clipboard with auto-clear countdown (60s default) | — |
| 22 | Add item form (Login type — full with URIs, max 3) | 3.2 |
| 23 | Add item form (Card, Note, Identity types) | 4.10 |
| 24 | Edit item form (pre-populated from existing item) | 4.10, 4.11 |
| 25 | Password generator (random + passphrase, inline popover) | — |
| 26 | Password history (last 5, push on save) | 4.11 |
| 27 | Custom fields editor (add/remove key-value pairs) | 4.11 |
| 28 | TOTP display with live countdown | — |

### Phase 2d: Security Dashboard (Week 5)

| # | Task | Depends On |
|---|------|-----------|
| 29 | Vault health score card (red/yellow/green) | 3.2 |
| 30 | HIBP breach check (k-anonymity API, client-side) | 3.2 |
| 31 | Reused password detection | 3.2 |
| 32 | Weak password detection (zxcvbn) | 3.2 |
| 33 | Password aging report (>2 years) | 3.2 |
| 34 | 2FA audit (sites where 2FA not configured) | 3.2 |

### Phase 2e: Settings (Week 5)

| # | Task | Depends On |
|---|------|-----------|
| 35 | Settings page with tab/section navigation | 4.1 |
| 36 | Change email flow (OTP verification) | 0.1 |
| 37 | Change master password flow (re-wrap vault key) | 0.1, 0.3 |
| 38 | MFA setup/disable UI (TOTP + passkey) | — |
| 39 | Recovery key view/regenerate | 0.1 |
| 40 | Login history display (last 20 events) | 0.1 |
| 41 | Vault timeout preference (dropdown, functional) | 3.3 |
| 42 | Clipboard auto-clear preference (dropdown, functional) | 3.3 |
| 43 | Light/dark theme toggle | 2.4 |
| 44 | Stripe Customer Portal link | 0.1 |
| 45 | Delete account (confirmation dialog + grace period info) | 0.1 |

### Phase 2f: Import/Export + Attachments (Week 6)

| # | Task | Depends On |
|---|------|-----------|
| 46 | CSV import with field-mapping UI | `@ironlox/crypto` CSV parser |
| 47 | CSV template download | — |
| 48 | Plaintext CSV export (with security warning dialog) | `@ironlox/crypto` CSV exporter |
| 49 | Password-protected JSON export | `@ironlox/crypto` |
| 50 | Attachment upload UI (drag-and-drop + file picker) | 0.1, R2 |
| 51 | Attachment download/delete UI | 0.1 |
| 52 | Quota display (free 250MB / premium 2GB) | 0.1 |

### Phase 2g: Polish (Week 7)

| # | Task | Depends On |
|---|------|-----------|
| 53 | i18n: Replace all hardcoded strings with `t()` calls | 4.5 |
| 54 | Sonner toast integration (success/error/info for all actions) | — |
| 55 | Responsive audit: test all breakpoints | — |
| 56 | Keyboard navigation (Tab, Enter, Escape, shortcuts) | — |
| 57 | PWA manifest + apple-touch-icon | — |
| 58 | CSP header verification | — |
| 59 | axe-core accessibility scan + fixes | — |
| 60 | Component tests (Vitest + Testing Library) | — |
| 61 | E2E tests (Playwright: signup → add password → sync → search → export) | — |

---

## 5. Cross-Cutting Concerns

### 5.1 i18n (i18next)
- **All user-facing strings** must use `t("key")` from `react-i18next`.
- `en.json` already has ~98 keys. Add missing keys as needed.
- Valid keys for i18next: snake_case or dot.separated. Choose one and be consistent.
- No hardcoded English strings anywhere in JSX after this phase.

### 5.2 Error Handling
- Wrap every API call in try/catch. Map error codes to user-friendly messages (see spec §29).
- Show toasts for transient errors ("Connection lost — retrying...").
- Show inline errors for form validation failures.
- Persistent error banners for critical errors (vault decryption failure).

### 5.3 Loading States
- **Every data fetch** must have a loading state: skeleton, spinner, or shimmer.
- Button loading state during API calls (disable + spinner).
- Optimistic updates where possible (vault item add/edit/delete).

### 5.4 Empty States
- Empty vault: "No passwords yet" + ghost illustration + "Add your first password" button + "Import" link.
- Empty search: "No items match [query]" + suggestion to broaden search.
- Empty category filter: "No [logins/cards/notes] yet" + add CTA for that category.

### 5.5 Offline Handling
- Detect offline via `navigator.onLine` + online/offline events.
- Show "You're offline — read-only mode" banner.
- Disable add/edit/delete when offline.
- Queue pending changes? (No — v1: require connection for writes per spec §12.3.)

### 5.6 Security
- Never log plaintext, keys, or auth hashes.
- Clipboard auto-clears after 60s (configurable).
- Password fields auto-hide after 30s or on blur.
- CSP headers already configured in `next.config.js`.
- No secrets in client bundles (verify with `next build` output audit).

---

## 6. Dependencies to Add

| Package | Purpose |
|---------|---------|
| shadcn/ui (primitives) | UI component library |
| next-themes | Light/dark theme toggle |
| @radix-ui/react-* | Peer deps for shadcn/ui |
| class-variance-authority | cva() for shadcn/ui variants |
| clsx + tailwind-merge | cn() utility |
| date-fns | Date formatting (login history, item timestamps) |

---

## 7. Implementation Order (Prioritized)

1. **Emergency fixes** (0.1–0.4) — unblock everything
2. **shadcn/ui installation** (2.1–2.3) — component foundation
3. **State management refactor** (3.1–3.3) — data foundation
4. **Auth flow** (4a: login, signup, MFA, recovery, onboarding) — user flow foundation
5. **Vault core** (4b: list, search, filter, sort) — core product
6. **Vault detail + add/edit** (4c: detail, forms, generator) — core product
7. **Security dashboard** (4d: health reports) — premium feature
8. **Settings** (4e: account, security, preferences, billing) — account management
9. **Import/Export + Attachments** (4f) — data portability + premium
10. **Polish** (4g: i18n, toasts, responsive, a11y, tests) — ship quality

---

## 8. Files to Delete / Replace

| File | Action | Reason |
|------|--------|--------|
| `src/app/page.tsx` | Replace | Single-file prototype → routing |
| `src/components/providers.tsx` | Rewrite | Use shadcn/ui Toaster, next-themes, refactored VaultProvider |
| `src/lib/vault-context.tsx` | Rewrite | Structured state with sync engine |
| `src/app/globals.css` | Rewrite | Merge Tailwind v4 + shadcn/ui CSS variables |

---

## 9. Success Criteria (Phase 2 Complete)

- [ ] All routes listed in §1.1 exist and render
- [ ] shadcn/ui is the component library; no raw `button`/`input`/`select` elements
- [ ] All strings use i18next `t()` — zero hardcoded English strings
- [ ] ApiClient is shared via context, tokens persist in localStorage, refresh works
- [ ] Vault syncs to server: login → fetch → decrypt → display; mutation → encrypt → upload
- [ ] Login, signup, MFA verify, recovery key login all functional
- [ ] Onboarding flow: welcome (3-option) + recovery key mandatory save
- [ ] Vault list: Fuse.js search, category filter, sort, empty state
- [ ] Item detail: masked/unmasked fields, copy with countdown, TOTP display
- [ ] Add/Edit item: all 4 types, password generator, custom fields, URI enforcement
- [ ] Security dashboard: breach check, reuse, weakness, aging, 2FA audit (premium)
- [ ] Settings: email change, password change, MFA, recovery key, preferences, delete account
- [ ] Import CSV with field mapping, export CSV/JSON
- [ ] File attachment upload/download/delete with quota display
- [ ] Light/dark theme toggle
- [ ] Loading states (skeletons) and empty states on every data view
- [ ] Sonner toasts for success/error/info on every action
- [ ] Responsive: cards on mobile (<768px), table on desktop (>1024px)
- [ ] Keyboard navigable (Tab, Enter, Escape)
- [ ] axe-core accessibility audit passes with zero critical violations
- [ ] Component tests for critical components
- [ ] E2E: signup → add password → sync → search → export flow
- [ ] No secrets in client bundle
