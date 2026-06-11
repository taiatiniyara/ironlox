# Ironlox — Deployment Guide

This guide walks you through deploying every piece of the Ironlox platform. No prior Cloudflare or deployment experience needed — each step explains what you're doing and why.

---

## What You're Deploying

Ironlox has 4 pieces that need to go live:

| Piece | What it is | Where it lives | URL |
|-------|-----------|---------------|-----|
| **Worker API** | The backend server (handles auth, vault sync, payments) | Cloudflare Workers | `api.ironlox.com` |
| **Web App** | The dashboard users open in their browser | Cloudflare Pages | `app.ironlox.com` |
| **Marketing Site** | The public landing page | Cloudflare Pages | `ironlox.com` |
| **Browser Extension** | The Chrome/Firefox add-on that autofills passwords | Chrome Web Store & Firefox Add-ons | (browser stores) |

---

## Before You Start

You'll need these accounts. Create them now if you haven't already:

1. **Cloudflare account** — go to [cloudflare.com](https://cloudflare.com) and sign up (free tier works). You need Workers, D1, R2, and KV — all included in the free tier for development.
2. **Wrangler CLI installed** — open your terminal and run:
   ```bash
   pnpm add -g wrangler
   ```
   Then log in:
   ```bash
   wrangler login
   ```
   This opens a browser window. Click "Allow" to give Wrangler access to your Cloudflare account.

3. **Stripe account** — go to [stripe.com](https://stripe.com) and sign up. You'll need the API keys from your Stripe dashboard. (You can use test mode keys while developing.)
4. **Domain name** — you need a domain (like `ironlox.com`) managed on Cloudflare DNS. If your domain is elsewhere, [transfer it to Cloudflare](https://developers.cloudflare.com/dns/zone-setups/full-setup/) first.
5. **Chrome Web Store developer account** (one-time $5 fee) — only if you're publishing the extension. Sign up at the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
6. **Firefox Add-ons developer account** (free) — only if you're publishing the extension. Sign up at the [Firefox Developer Hub](https://addons.mozilla.org/developers/).
7. **GitHub account** — you'll push the code to GitHub so Cloudflare Pages can deploy it automatically.

---

## Step 1 — Create Cloudflare Resources (Do Once)

These are the building blocks your backend needs. You'll create three things via the command line and write down the IDs they give you.

### 1A. Create the D1 Database

D1 is Cloudflare's serverless SQL database. It stores user accounts, session tokens, and vault metadata (not the actual passwords — those are encrypted in R2).

```bash
wrangler d1 create ironlox
```

After running this, you'll see output like:
```
✅ Successfully created DB 'ironlox' in region '....'
Created database 'ironlox' with id: abc123-def456-ghi789
```

**Copy that `id` value.** You'll paste it into the config file in the next step.

> **What is this?** D1 is like SQLite but it runs on Cloudflare's edge network. It stores things like "user bob exists" and "bob's vault was last synced at 3pm" — but never the actual passwords (those stay encrypted).

### 1B. Create the R2 Bucket

R2 is Cloudflare's file storage (like AWS S3). It stores the encrypted vault blobs — the actual password data, which is encrypted before it ever leaves the user's device.

```bash
wrangler r2 bucket create ironlox-vault
```

After it's created, go to the Cloudflare Dashboard in your browser:
- Click **R2** in the left sidebar
- Click the **ironlox-vault** bucket
- Go to the **Settings** tab
- Enable **Object Versioning** and set the retention to **7 days**

> **What is this?** Object versioning keeps old copies of files when they're overwritten. If a user accidentally corrupts their vault, they can restore a version from up to 7 days ago.

### 1C. Create the KV Namespace

KV (Key-Value) is Cloudflare's fast key-value store. It stores feature flags (like "is the new login page enabled?") and rate limiting counters.

```bash
wrangler kv:namespace create IRONLOX_KV
```

You'll see output like:
```
✅ Successfully created namespace 'IRONLOX_KV' with id: xyz789-uvw012
```

**Copy that `id` value.** You'll paste it into the config file next.

> **What is this?** KV is like a global dictionary. Workers use it to check things quickly without touching the database — for example, "has this IP address made too many login attempts?"

---

## Step 2 — Fill In the Config File (Do Once)

Open the file `apps/worker/wrangler.toml` in your code editor. This is the configuration file for the Worker — it tells Cloudflare which database, bucket, and KV namespace to connect to.

Find these lines and replace the empty strings with the IDs you copied:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ironlox"
database_id = "abc123-def456-ghi789"    # ← Paste your D1 ID here

[[r2_buckets]]
binding = "VAULT"
bucket_name = "ironlox-vault"

[[kv_namespaces]]
binding = "KV"
id = "xyz789-uvw012"                     # ← Paste your KV ID here
```

> **What is `binding`?** It's the variable name your code uses to access the resource. Don't change these — the code expects `DB`, `VAULT`, and `KV`.

---

## Step 3 — Set Secrets (Do Once)

Secrets are sensitive values like API keys and passwords. Never put these in the `wrangler.toml` file (that file gets committed to git). Instead, you store them as encrypted secrets on Cloudflare.

Run each command in your terminal. Wrangler will prompt you to paste the value — type or paste it, press Enter, and the value is uploaded securely to Cloudflare (it won't show on screen).

First, navigate to the worker directory:
```bash
cd apps/worker
```

### 3A. JWT Secret

JWT (JSON Web Tokens) are how the server knows you're logged in. The server signs a token with this secret, and later verifies the signature to confirm the token is real.

Generate a random 64-character secret (run this in your terminal):
```bash
openssl rand -base64 64
```

Copy the output, then run:
```bash
wrangler secret put JWT_SECRET
```
Paste the random string when prompted.

> **Windows users:** If `openssl` isn't available, use PowerShell:
> ```powershell
> [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
> ```

### 3B. Stripe Secret Key

In your Stripe Dashboard, go to **Developers → API keys**. You'll see a "Secret key" that starts with `sk_live_...` (or `sk_test_...` for testing).

```bash
wrangler secret put STRIPE_SECRET_KEY
```
Paste the key when prompted.

### 3C. Stripe Webhook Secret

You'll set this up properly in Step 7 (webhooks), but for now you can leave it blank or set it to the test webhook secret from your Stripe dashboard.

```bash
wrangler secret put STRIPE_WEBHOOK_SECRET
```

### 3D. Turnstile Secret Key

Turnstile is Cloudflare's CAPTCHA replacement (no "click all the traffic lights" puzzles). It makes sure login/registration requests come from real humans, not bots.

1. Go to Cloudflare Dashboard → **Turnstile** (in the left sidebar)
2. Click **Add Site**
3. Name it "Ironlox", add the domain `app.ironlox.com`
4. Copy the **Secret key** (starts with `1x000...`)

```bash
wrangler secret put TURNSTILE_SECRET_KEY
```
Paste the secret key.

### 3E. MailChannels API Key (Optional)

MailChannels sends transactional emails (welcome emails, password reset, etc.). If you don't have a MailChannels account yet, skip this for now — emails will silently fail during development.

1. Sign up at [mailchannels.com](https://mailchannels.com)
2. Get your API key from the dashboard

```bash
wrangler secret put MAILCHANNELS_API_KEY
```

### 3F. Sentry DSN (Optional)

Sentry tracks errors in production. If you don't have a Sentry account, skip this.

```bash
wrangler secret put SENTRY_DSN
```

---

## Step 4 — Deploy the Worker API

The Worker is your backend. It handles all API requests — user registration, login, vault sync, payments.

### 4A. Apply Database Migrations

Migrations create the database tables your app needs. Think of them like a blueprint for the database.

```bash
cd apps/worker
wrangler d1 migrations apply ironlox
```

You'll see it apply each migration file. After this, your database has all the tables (`users`, `sessions`, `vault_metadata`, etc.).

> **When to run this again:** Any time you pull new code that changes the database schema (new tables, new columns). The migrations are safe to run multiple times — they only apply what hasn't been applied yet.

### 4B. Deploy the Worker

```bash
wrangler deploy
```

This uploads your Worker code to Cloudflare's edge network (300+ locations worldwide). You'll see output like:
```
Deployed ironlox-api (xx.xx sec)
  https://ironlox-api.your-subdomain.workers.dev
```

### 4C. Verify It Works

Test that the API is alive:
```bash
curl https://ironlox-api.your-subdomain.workers.dev/health
```

You should see:
```json
{"status":"ok","timestamp":"2026-06-11T...","version":"0.1.0"}
```

If you get an error or no response, see the [Troubleshooting](#troubleshooting) section at the bottom.

> **"I don't have curl?"** — Open the URL in your browser instead. If the page shows the JSON above, it works.

---

## Step 5 — Deploy the Web App

The Web App is the dashboard users see when they log in at `app.ironlox.com`. It's built with Next.js (a React framework) and runs entirely in the browser.

You'll deploy it to **Cloudflare Pages**, which automatically rebuilds and redeploys every time you push code to GitHub.

### 5A. Push Your Code to GitHub

If you haven't already, create a repo on GitHub and push:
```bash
git remote add origin https://github.com/your-username/ironlox.git
git push -u origin main
```

### 5B. Connect Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Workers & Pages** in the left sidebar
3. Click the **Pages** tab, then **Create a project → Connect to Git**
4. Select your GitHub repo
5. On the "Set up builds and deployments" screen, fill in:
   - **Project name**: `ironlox-web`
   - **Production branch**: `main`
   - **Framework preset**: Next.js (or choose "None" and set manually)
   - **Build command**: `pnpm run build --filter=@ironlox/web`
   - **Build output directory**: `apps/web/out`
   - **Root directory**: (leave empty)
6. Add environment variables (click "Add variable"):
   - `NEXT_PUBLIC_API_URL` = `https://api.ironlox.com`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = your Stripe publishable key (starts with `pk_live_...` or `pk_test_...`)
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = your Turnstile site key (from the Cloudflare Turnstile dashboard)
7. Click **Save and Deploy**

> **What are `NEXT_PUBLIC_` variables?** In Next.js, variables starting with `NEXT_PUBLIC_` are bundled into the browser JavaScript. They're safe to expose (they're public keys, not secrets). Never put secret keys here.

### 5C. Set Up the Custom Domain

After the first deploy succeeds:
1. Go to your Pages project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter `app.ironlox.com`
4. Cloudflare will auto-configure DNS. Wait a few minutes for it to activate.

---

## Step 6 — Deploy the Marketing Site

The marketing site is the public landing page at `ironlox.com`. It's a static site built with Astro.

### 6A. Create Another Cloudflare Pages Project

Same process as the web app, but with different settings:

1. Cloudflare Dashboard → **Workers & Pages → Pages → Create → Connect to Git**
2. Select the same GitHub repo
3. Configure:
   - **Project name**: `ironlox-marketing`
   - **Production branch**: `main`
   - **Framework preset**: Astro (or set manually)
   - **Build command**: `pnpm run build --filter=@ironlox/marketing`
   - **Build output directory**: `apps/marketing/dist`
   - **Root directory**: (leave empty)
4. No environment variables needed (marketing site doesn't call the API)
5. Click **Save and Deploy**

### 6B. Set Up the Custom Domain

1. Go to the marketing Pages project → **Custom domains**
2. Add `ironlox.com` as the custom domain
3. Also add `www.ironlox.com` and set it to redirect to `ironlox.com`

---

## Step 7 — DNS Setup

If you followed Steps 5C and 6B, Cloudflare already configured the DNS for `app.ironlox.com` and `ironlox.com`. Now you need to point the API subdomain.

### Route `api.ironlox.com` to Your Worker

1. Go to Cloudflare Dashboard → **Workers & Pages**
2. Click your `ironlox-api` Worker
3. Go to the **Triggers** tab (or **Routes**)
4. Click **Add route**
5. Enter: `api.ironlox.com/*`
6. Click **Add route**

Wait a few minutes for DNS to propagate, then test:
```bash
curl https://api.ironlox.com/health
```

---

## Step 8 — Stripe Webhooks

Webhooks let Stripe tell your server about events (like "someone subscribed" or "a payment failed").

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL**: `https://api.ironlox.com/webhooks/stripe`
4. **Events to listen for** (click "Select events" and add these):
   - `checkout.session.completed` — someone finished checkout
   - `customer.subscription.updated` — subscription changed
   - `customer.subscription.deleted` — subscription cancelled
   - `invoice.payment_succeeded` — payment went through
   - `invoice.payment_failed` — payment failed
5. Click **Add endpoint**
6. After creating, Stripe shows a **Signing secret** (starts with `whsec_...`). Copy it.
7. Upload it to your Worker:
   ```bash
   cd apps/worker
   wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
   Paste the signing secret.
8. Redeploy the Worker so it picks up the new secret:
   ```bash
   wrangler deploy
   ```

> **Why a signing secret?** It proves the webhook really came from Stripe (not an attacker). Your server checks the signature before trusting the data.

---

## Step 9 — Publish the Browser Extension

The extension is what users install in Chrome or Firefox. It autofills passwords on websites.

### 9A. Build the Extension

```bash
cd apps/extension

# Tell the extension where your API lives
export PLASMO_PUBLIC_API_URL=https://api.ironlox.com

# Build for Chrome
pnpm run build
# Output: build/chrome-mv3-prod/

# Build for Firefox
pnpm run build:firefox
# Output: build/firefox-mv3-prod/

# Create zip file for the Chrome Web Store
pnpm run package
# Output: build/chrome-mv3-prod.zip
```

### 9B. Submit to Chrome Web Store

1. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click **New Item** → upload the `.zip` file from `build/chrome-mv3-prod.zip`
3. Fill in the store listing:
   - **Description**: Write a paragraph about what Ironlox does
   - **Screenshots**: You need 1-5 images (1280x800 or 640x400)
   - **Category**: Productivity
   - **Language**: English
   - **Privacy policy URL**: `https://ironlox.com/privacy`
   - **Permissions justification**: "This extension needs access to read and modify web pages in order to autofill your saved passwords and credit cards on login forms and checkout pages."
4. Submit for review. It usually takes 3-5 business days.

### 9C. Submit to Firefox Add-ons

1. Go to the [Firefox Developer Hub](https://addons.mozilla.org/developers/)
2. Click **Submit a New Add-on**
3. Upload the `.xpi` file from `build/firefox-mv3-prod/` (Firefox builds produce `.xpi` instead of `.zip`)
4. Fill in the same metadata as Chrome
5. Submit for review. Firefox reviews are usually faster (1-3 business days).

---

## Step 10 — Verify Everything

After deploying, check that everything works end-to-end:

- [ ] **API health**: Visit `https://api.ironlox.com/health` — should show `{"status":"ok"}`
- [ ] **User registration**: Try creating an account through the web app
- [ ] **User login**: Log in and confirm you get a JWT (open browser DevTools → Application → Local Storage — you should see a token)
- [ ] **Marketing site**: Visit `https://ironlox.com` — the landing page loads
- [ ] **Web app**: Visit `https://app.ironlox.com` — the dashboard loads
- [ ] **Turnstile**: After 3 failed login attempts, a CAPTCHA should appear on the login form
- [ ] **Stripe webhook**: Go to Stripe Dashboard → Webhooks → your endpoint → click "Send test webhook" — it should return HTTP 200
- [ ] **Extension install**: Sideload the extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked → select `apps/extension/build/chrome-mv3-dev/`) and confirm it works

---

## Day-to-Day Redeploys

After the initial setup, here's all you need to do for routine updates:

```bash
# Worker API (any time you change backend code)
cd apps/worker
wrangler d1 migrations apply ironlox   # only if you changed the database schema
wrangler deploy

# Web App + Marketing Site (automatic!)
git push
# Cloudflare Pages detects the push and redeploys automatically

# Extension (any time you change extension code)
cd apps/extension
pnpm run build
pnpm run package
# Upload the new zip to Chrome Web Store + Firefox Add-ons
```

---

## Environment Variables — Complete Reference

Here are all the variables, where they go, and what they do:

| Variable | Owner | Type | What it does |
|----------|-------|------|-------------|
| `JWT_SECRET` | Worker | **Secret** | Signs login tokens so the server can verify who you are |
| `STRIPE_SECRET_KEY` | Worker | **Secret** | Lets the server talk to Stripe (create checkout sessions, manage subscriptions) |
| `STRIPE_WEBHOOK_SECRET` | Worker | **Secret** | Verifies that webhook requests really came from Stripe |
| `TURNSTILE_SECRET_KEY` | Worker | **Secret** | Verifies CAPTCHA answers on the server side |
| `MAILCHANNELS_API_KEY` | Worker | **Secret** | Sends welcome emails, password resets, etc. |
| `SENTRY_DSN` | Worker | **Secret** | Sends error reports to Sentry |
| `NEXT_PUBLIC_API_URL` | Web App | Public | Tells the browser where the API lives |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Web App | Public | Shows the Stripe checkout form |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Web App | Public | Shows the CAPTCHA widget |
| `PLASMO_PUBLIC_API_URL` | Extension | Public | Tells the extension where the API lives |

> **Secret vs Public**: Secrets go via `wrangler secret put` and are encrypted on Cloudflare's servers. Public variables are bundled into the browser code and visible to anyone who inspects the page source.

---

## Troubleshooting

### "wrangler: command not found"

You haven't installed Wrangler. Run:
```bash
pnpm add -g wrangler
```

### "wrangler deploy" fails with authentication error

You're not logged in. Run:
```bash
wrangler login
```

### Database migrations fail

Make sure you're in the right directory:
```bash
cd apps/worker
wrangler d1 migrations apply ironlox
```
If you get "no such database", double-check that the `database_id` in `wrangler.toml` matches the ID from `wrangler d1 create ironlox`.

### Health check returns nothing or an error

1. Check the Worker logs:
   ```bash
   wrangler tail
   ```
   This streams live logs — try the health check URL again and watch for errors.

2. Make sure your `wrangler.toml` has all three bindings (D1, R2, KV) with real IDs (not empty strings).

3. If you're using a custom domain (`api.ironlox.com`), make sure DNS is set up (Step 7). Try the direct `workers.dev` URL first — if that works but the custom domain doesn't, the problem is DNS.

### Cloudflare Pages build fails

1. Check the build log in the Cloudflare Pages dashboard — it shows the exact error.
2. Common issues:
   - **"pnpm: command not found"** → Cloudflare Pages needs pnpm. In your Pages project settings, set the `PNPM_VERSION` environment variable to `9.15.0`.
   - **Build command wrong** → Make sure it's exactly `pnpm run build --filter=@ironlox/web` (or `@ironlox/marketing` for the marketing site).
   - **Node version too old** → Set `NODE_VERSION` env variable to `22` in Pages settings.

### Extension won't install in Chrome

When testing locally, you must load it as an "unpacked extension":
1. Open `chrome://extensions`
2. Turn on **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `apps/extension/build/chrome-mv3-dev/` folder (not the zip)

### Stripe webhook returns "No such webhook endpoint"

Make sure you redeployed the Worker after setting the webhook secret:
```bash
cd apps/worker
wrangler deploy
```
