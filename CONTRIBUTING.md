# Contributing to Ironlox

Thank you for your interest in contributing. Ironlox is a zero-knowledge consumer password manager, and security is paramount. Please read this guide before submitting any changes.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.

## Developer Certificate of Origin

By contributing to this project, you certify that you have the right to submit the work under the MIT license and agree to the [Developer Certificate of Origin](https://developercertificate.org/) (DCO) for all commits.

<details>
<summary>DCO text</summary>

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```
</details>

Add `Signed-off-by: Your Name <your@email.com>` to your commit messages.

## Development Setup

### Prerequisites

- Node.js >= 22
- pnpm >= 9
- Cloudflare account (optional, for running the worker locally)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (optional)

### Setup

```bash
git clone https://github.com/ironlox/ironlox.git
cd ironlox
pnpm install
cp .env.example .env
# Edit .env with development values
pnpm run dev
```

See [DEPLOY.md](DEPLOY.md) for Cloudflare-specific setup.

## Project Structure

This is a Turborepo monorepo with pnpm workspaces:

- `apps/` — applications (worker, web, extension, marketing)
- `packages/` — shared libraries (crypto, schemas, autofill, api-client)
- `docs/` — product specification and roadmap

## Coding Conventions

### General

- TypeScript strict mode everywhere. No `any` unless absolutely necessary.
- Prefer functions over classes. Pure functions over side effects.
- All user-facing strings in `en.json` translation files (i18next). Never hardcode strings in JSX.
- UUIDv4 for all IDs. ISO 8601 for all timestamps. UTC only.
- `@/` path alias maps to package/app root.

### Crypto (`packages/crypto`)

The most critical package. Changes must be reviewed carefully:

- All exports: named, pure, synchronous where possible
- No third-party crypto beyond Web Crypto API (SubtleCrypto)
- Constant-time comparison for all secret values
- Every function must have: unit tests with known vectors, property-based tests, and JSDoc with algorithm reference

**Crypto tests must maintain 100% branch coverage. CI will reject any drop.**

### Worker (`apps/worker`)

- Stateless — no mutable shared state between requests
- Every route: validate input (Zod) -> authorize (JWT middleware) -> execute -> return typed response
- D1 queries: use parameterized queries, never string interpolation

### Security Rules (non-negotiable)

- **Never implement encryption outside `packages/crypto`.**
- **Never send the master password to the server.**
- **Never log plaintext, keys, or auth hashes.**
- **Never add third-party analytics/tracking scripts to any client.**
- Don't use `fetch()` directly — use Hono RPC client via `@ironlox/api-client`.
- Don't bypass Zod validation — all inputs validated at the API boundary.

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
- [ ] No `console.log` in production code
- [ ] PR references spec section(s) from `docs/product-spec.md`
- [ ] Commits signed off with DCO

## Commit Convention

- Prefix feature branches: `feat/`, bug fixes: `fix/`, docs: `docs/`, chores: `chore/`
- Write clear, descriptive commit messages
- Sign off all commits: `git commit -s -m "description"`

## Reporting Issues

- **Security issues**: email [security@ironlox.com](mailto:security@ironlox.com). Do not file public issues.
- **Bugs**: use the Bug Report template
- **Feature requests**: use the Feature Request template
