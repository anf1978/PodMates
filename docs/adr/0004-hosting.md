# ADR 0004: GitHub Pages deployed through Actions (D4)

**Status:** Proposed

## Context

The app is static and already hosted on GitHub Pages. Deployment should consume
verified build output rather than a manually uploaded HTML file.

## Decision

Propose staying on GitHub Pages, deploying through Actions and adding a service
worker in the later PWA phase. Firebase Hosting and Cloudflare Pages remain alternatives.
No human agreement was supplied; this records the recommendation, not approval.

## Consequences

Hosting stays familiar, but Pages cannot supply arbitrary cache headers.
The service worker needs explicit update/offline tests. Switching the Pages source
and enabling protection require human administration.
See [plan D4](../refactor-plan.md#9-decisions-for-review).
