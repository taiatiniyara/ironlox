## Description

<!-- Briefly describe the changes in this PR. -->

## Related Issue

<!-- Link to the issue this PR addresses (e.g. Closes #123). -->

## Type of Change

- [ ] Bug fix (non-breaking change addressing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Documentation update
- [ ] Refactor (no functional changes)
- [ ] Performance improvement

## Checklist

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
- [ ] Commits signed off with DCO (`git commit -s`)

## Security Considerations

<!-- Describe any security implications of this change. If none, write "None". -->

## Screenshots (if applicable)

<!-- Add screenshots/videos of UI changes. -->
