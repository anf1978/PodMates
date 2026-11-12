# 025: Colour themes and text size

Date: 2026-11-12

## Summary

PodMates offers 27 colour themes and four text sizes, chosen in **My Profile → Display settings**. The choice
applies at once, is remembered on that device, and is already in place when the page first draws, so there is no
flash of the default colours. Every theme is checked automatically so its text stays readable.

## What users see

- **My Profile** (`014`) → **Display settings — colour themes**: a grid of the 27 themes (Classic is the default) and
  a **Text size** choice: Normal, Large (115 %), Larger (130 %), Largest (150 %).
- Choosing one shows a toast ("<Theme> colours applied." / "Text size: Large.") and recolours or rescales the page
  immediately; the radar redraws for the new size.
- On the next visit, the same theme and size appear from the first frame.

## How it works

- `index.ts`: `mount(container)` renders the Display settings tray; that is the whole public API.
- `palette.ts`: the theme list and pure colour maths (`buildTheme` derives every CSS variable from a theme's base
  colours; `auditThemes` checks contrast; `findTheme`, `THEME_VARS`).
- `apply.ts`: `applyTheme` / `applyTextSize` write the CSS variables, `data-pm-theme` / `data-pm-text` on `<html>`,
  `zoom` / `--pm-zoom` and the `theme-color` meta, and save the choice (unless silent); `currentTheme`,
  `currentTextSize`, `TEXT_SIZES`. The root attributes are the single record of what is applied, so the two bundled
  copies (tray and pre-paint) agree.
- `prepaint.ts`: applies the saved choices silently. It is **not** a module at runtime: `index.html` keeps
  `<script id="theme-script" src="./src/features/themes/prepaint.ts">`, and `scripts/theme-prepaint.mjs` bundles it
  to a classic IIFE and inlines it in `<head>` (dev and build) before the CSP hashes are computed. Keep it small: it
  blocks first paint.
- `view.ts`: the tray template. `themes.css`, prefixes `pm-theme-`, `pm-size-`, `pm-display-`.

Wiring: `src/app/profile.ts` passes `mount` to My Profile as its `displaySettings` port. The radar reads
`data-pm-text`.

Events: none.

Data: local storage `podmates-theme` (theme id; unknown ids fall back to Classic) and `pm-text-scale` (`"1"`,
`"1.15"`, `"1.3"`, `"1.5"`). Per device; nothing in Firestore.

## Testing

- Unit: `themes.test.ts` (the audit must stay empty; snapshot of every theme's computed values in
  `__snapshots__/themes.test.ts.snap`; names; apply/save/clear on the root; text scaling and radar redraw; pre-paint
  applies without saving or announcing; the tray applies choices).
- e2e: `themes.spec.ts` (a theme and text size survive a reload before first paint).
- By hand: My Profile → Display settings, pick a dark theme and Larger text, reload the page: no flash of Classic.

## Risks and rollback

A change to `palette.ts` moves the snapshot on purpose; review the diff. A broken pre-paint leaves Classic colours
(each step is wrapped in `try`). Roll back with `git revert`.

## Follow-ups

None.

## Related

`004`, `014` (My Profile hosts the tray).
