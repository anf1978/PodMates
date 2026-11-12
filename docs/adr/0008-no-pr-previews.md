# ADR 0008: No PR preview deployments

**Status:** Proposed (2026-11-12, p6-1)

## Context

Changes go straight to `main` from Claude cloud sessions on a phone ([ADR 0001](0001-development-workflow.md)).
A preview site per PR or branch would need a second hosting setup (GitHub Pages serves one site per repository),
a service-account secret for that host, and a Firebase Auth authorized domain added by hand for every preview
domain, because Firebase does not accept wildcards. That is a lot of setup and upkeep for a one-developer site
worked on from a phone.

## Decision

Don't add a preview host. Try changes on the live site after the CI-gated deploy (only commits whose CI passed are
published), and roll back with one tap if needed: Deploy Pages → Run workflow with an older `ref`, followed by a
`git revert` ([phone-workflow.md](../phone-workflow.md)). Reconsider only if the humans ask for previews.

## Consequences

Every change that goes live is seen by real users first, so CI (unit, golden and browser tests) carries the weight
a preview would. Risky changes can still use an optional PR and a build-only Deploy Pages run, which builds and
validates without publishing. No new secrets, accounts or Firebase settings are needed.
