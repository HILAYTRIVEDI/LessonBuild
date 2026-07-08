<!-- Keep PRs small and focused: one task = one reviewable deliverable. -->

## Summary

<!-- What does this PR do and why? Link the plan task if applicable (e.g. "Task 2"). -->

## Changes

<!-- Bullet the notable changes. -->

-

## Checklist

- [ ] Follows the conventional-commit format (`feat:`, `fix:`, `chore:`, `docs:`, …)
- [ ] `pnpm lint` passes clean
- [ ] `pnpm test` passes (new behaviour is covered by tests — TDD)
- [ ] TypeScript standards upheld — no `any` (use `unknown` + guard), untrusted boundaries validated with Zod, discriminated unions with exhaustive `never` checks, cross-package imports via package entrypoints
- [ ] No gradients introduced in the UI (solid fills + subtle shadows only)
- [ ] No secrets committed — configuration only via env (`.env.example` updated if new keys added)

## Notes for reviewers

<!-- Anything reviewers should pay special attention to, trade-offs, follow-ups. -->
