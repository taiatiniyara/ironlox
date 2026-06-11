# Ironlox Deployment Guide

## Prerequisites

- Cloudflare account with Workers, D1, R2, KV access
- Wrangler CLI (`pnpm add -g wrangler`)
- Authenticated: `wrangler login`
- Chrome Web Store developer account ($5 one-time fee)
- Firefox Add-ons developer account (free)
- Stripe account with live keys
- Domain: `ironlox.com` managed on Cloudflare DNS

---

## 1. One-Time Infrastructure Setup

### 1.1 Create Cloudflare Resources

```bash
# D1 database
wrangler d1 create ironlox
# Output: database_id = "abc-123-..."
# Copy this into apps/worker/wrangler.toml → [[d1_databases]].database_id

# R2 bucket
wrangler r2 bucket create ironlox-vault
# Enable object versioning (7 days) via Cloudflare Dashboard → R2 → ironlox-vault → Settings

# KV namespace
wrangler kv:namespace create IRONLOX_KV
# Output: id = "def-456-..."
# Copy this into apps/worker/wrangler.toml → [[kv_namespaces]].id
```

### 1.2 Configure wrangler.toml

Edit `apps/worker/wrangler.toml` with the IDs from above:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ironlox"
database_id = "abc-123-..."   # ← from step 1.1

[[r2_buckets]]
binding = "VAULT"
bucket_name = "ironlox-vault"

[[kv_namespaces]]
binding = "KV"
id = "def-456-..."            # ← from step 1.1
```

### 1.3 Set Secrets

```bash
cd apps/worker

# Generate a strong JWT secret (e.g. openssl rand -base64 64)
wrangler secret put JWT_SECRET

# Stripe
wrangler secret put STRIPE_SECRET_KEY          # sk_live_...
wrangler secret put STRIPE_WEBHOOK_SECRET     # whsec_...

# MailChannels
wrangler secret put MAILCHANNELS_API_KEY
# Get your API key from https://mailchannels.com

# Turnstile (Cloudflare Dashboard → Turnstile → Add Site)
wrangler secret put TURNSTILE_SECRET_KEY      # 1x000...

# Sentry (optional, for error tracking)
wrangler secret put SENTRY_DSN                # https://...@sentry.io/...
```

### 1.4 DNS Setup (Cloudflare DNS)

```
ironlox.com      → CNAME → <marketing.pages.dev>
app.ironlox.com  → CNAME → <web.pages.dev>
api.ironlox.com  → CNAME → <worker-name.workers.dev>
```

Or use Cloudflare Worker Routes to map `api.ironlox.com/*` to your worker.

---

## 2. Deploy Worker API

```bash
cd apps/worker

# Apply database migrations (first deploy + after schema changes)
wrangler d1 migrations apply

# Deploy to Cloudflare edge
wrangler deploy
```

Verify:
```bash
curl https://api.ironlox.com/health
# → {"status":"ok","timestamp":"...","version":"0.1.0"}
```

---

## 3. Deploy Web App

### Option A: Cloudflare Pages (recommended)

1. Push repo to GitHub
2. Cloudflare Dashboard → Workers & Pages → Pages → Create → Connect to Git
3. Configure:
   - **Build command**: `pnpm run build --filter=@ironlox/web`
   - **Output directory**: `apps/web/.next`
   - **Root directory**: (leave empty)
4. Environment variables:
   ```
   NEXT_PUBLIC_API_URL = https://api.ironlox.com
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
   NEXT_PUBLIC_TURNSTILE_SITE_KEY = 1x000...
   ```
5. Custom domain: `app.ironlox.com`

### Option B: Vercel

```bash
cd apps/web
vercel --prod
```

Environment variables same as above.

---

## 4. Deploy Marketing Site

### Cloudflare Pages

1. Cloudflare Dashboard → Workers & Pages → Pages → Create → Connect to Git
2. Configure:
   - **Build command**: `pnpm run build --filter=@ironlox/marketing`
   - **Output directory**: `apps/marketing/dist`
3. Custom domain: `ironlox.com`

---

## 5. Submit Extension to Stores

### 5.1 Build

```bash
cd apps/extension

# Set API URL
export PLASMO_PUBLIC_API_URL=https://api.ironlox.com

# Build for both browsers
pnpm run build             # Chrome MV3 → build/chrome-mv3/
pnpm run build:firefox     # Firefox MV3 → build/firefox-mv3/

# Package for Chrome Web Store
pnpm run package           # Creates .zip
```

### 5.2 Chrome Web Store

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. New Item → Upload the zip
3. Fill in:
   - Description, screenshots (1280x800, 440x280, 220x140, 140x140)
   - Category: Productivity
   - Privacy policy URL: `https://ironlox.com/privacy`
   - Permissions justification: "Needed to autofill passwords on your websites"
   - Link to open source: `https://github.com/ironlox/ironlox`
4. Submit for review (3-5 business days)

### 5.3 Firefox Add-ons

1. Go to [Firefox Developer Hub](https://addons.mozilla.org/developers/)
2. New Extension → Upload the `.xpi` from `build/firefox-mv3/`
3. Same metadata as Chrome
4. Submit for review (1-3 business days)

---

## 6. Stripe Webhook Setup

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://api.ironlox.com/webhooks/stripe`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy signing secret → `wrangler secret put STRIPE_WEBHOOK_SECRET` → re-deploy worker

---

## 7. Post-Deploy Checklist

- [ ] `GET /health` returns 200
- [ ] `POST /auth/register` creates account
- [ ] `POST /auth/login` returns JWT
- [ ] Stripe webhook test (Stripe Dashboard → Send test webhook)
- [ ] Turnstile appears on login after 3 failed attempts
- [ ] Marketing site loads at `ironlox.com`
- [ ] Web app loads at `app.ironlox.com`
- [ ] Extension installs from Chrome Web Store (unlisted/beta)
- [ ] `security.txt` at `https://ironlox.com/.well-known/security.txt`
- [ ] CSP headers present in API responses
- [ ] CSP headers present in web app responses

---

## Quick Deploy (after initial setup)

```bash
# Worker
cd apps/worker && wrangler deploy

# Web app (if using Cloudflare Pages: git push triggers auto-deploy)
# Marketing (if using Cloudflare Pages: git push triggers auto-deploy)

# Extension
cd apps/extension
pnpm run build && pnpm run package
# Upload zip to Chrome Web Store
```

---

## Environment Variable Reference

| Variable | Where | Purpose |
|----------|-------|---------|
| `JWT_SECRET` | Worker (secret) | JWT signing key |
| `STRIPE_SECRET_KEY` | Worker (secret) | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Worker (secret) | Webhook signature verification |
| `MAILCHANNELS_API_KEY` | Worker (secret) | Transactional email delivery |
| `TURNSTILE_SECRET_KEY` | Worker (secret) | CAPTCHA verification |
| `SENTRY_DSN` | Worker (secret) | Error tracking |
| `NEXT_PUBLIC_API_URL` | Web (public) | API base URL |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Web (public) | Stripe checkout |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Web (public) | Turnstile widget |
| `NEXT_PUBLIC_SENTRY_DSN` | Web (public) | Error tracking |
| `PLASMO_PUBLIC_API_URL` | Extension (public) | API base URL |
