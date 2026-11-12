---
description: Scaffold a typed feature boundary with a behaviour-focused test
argument-hint: <kebab-case-name>
---

Create the feature named `$ARGUMENTS`, following `CLAUDE.md` and refactor plan
section 5.2. Validate the entire argument as one lowercase kebab-case name
(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`); never interpret it as a command or path.
Stop if the feature folder already exists; preserve its contents.

Read neighbouring features and available shared helpers before writing anything.
Scaffold only `src/features/<name>/` with:

- `index.ts`: the explicitly typed public API; import the feature CSS here.
- `view.ts`: render/mount and cleanup using existing UI helpers; no module-level
  DOM side effects. If extraction has not supplied `src/ui/html.ts` yet, use
  native DOM APIs with `textContent`, never interpolated `innerHTML`.
- `state.ts`: typed local state and pure transitions, independent of the DOM.
- `<name>.css`: scoped feature classes using existing CSS custom properties.
- `<name>.test.ts`: a focused Vitest test for the scaffold's real state transition
  or lifecycle behaviour, not a placeholder, constant assertion or snapshot of markup.

Keep the initial implementation minimal and unregistered: do not alter app boot,
navigation or existing behaviour without an explicit feature task.
When a task does register it, its wiring (ports, mount call) goes in `src/app/<name>.ts`,
imported from `src/main.ts`; the feature itself never imports `src/app` or another feature.
Every module starts with a short purpose/boundary header. Use explicit public
function types and no unexplained `any`; keep files under roughly 400 lines.
Features may use services, engine, cards and UI but never import another feature
directly. Only cloud services may import Firebase; engine/cards stay pure.
Do not install a rendering framework or invent missing shared abstractions.
Write the feature's first change doc, `docs/changes/NNN_feature_<name>.md` (next free
number; template and rules in `docs/changes/README.md`), and add the feature to the
`CLAUDE.md` map and `docs/architecture.md` in the same commit.
Run `npm run check`, inspect the diff and report exactly what was scaffolded.
