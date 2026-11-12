# Session p3-4 — UI primitives → `src/ui`

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` principle 4 ("one way to
do each thing"), decision D2 (lit-html), Phase 3 step 3.

## Task

1. `src/ui/html.ts`: re-export `html`, `render`, `nothing` from `lit-html` plus small helpers (`classMap`,
   `styleMap`, `unsafeHTML` only behind an explicitly named `trustedHtml()` with a comment saying when it is allowed).
2. **One modal/overlay system** `src/ui/modal.ts` that covers everything `tad-overlay`, `ps-overlay`,
   `showInfoModal`, `showConfirmModal` (and any other overlay you find by grepping) do today: open/close, Escape, focus
   trap + restore, scroll lock, stacking. Re-implement the old functions as thin shims over it, with **pixel-identical
   look** (reuse the existing CSS classes).
3. Move `tooltip`, `tabs`, status/toast and the **radar chart** into `src/ui/` with typed APIs. Shims keep old call
   sites working.
4. `src/styles/tokens.css`: move the existing CSS custom properties out of `index.html` unchanged; `base.css` for
   global rules.
5. Unit tests (Vitest + happy-dom/jsdom) for the modal (focus trap, Escape, stacking) and the radar chart (renders
   expected SVG for a fixed input).

## Done when

- `npm run check` + `npm run e2e` green; e2e covers opening and closing at least one modal.
- PR includes before/after screenshots of each modal type and the radar chart (Playwright screenshots are fine).
