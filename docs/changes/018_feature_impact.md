# 018: Impact cards and the Pod view

Date: 2026-11-12

## Summary

"Impact cards" are the cards PodMates treats as especially powerful when scoring a deck's Power. The site ships a
fixed default list. A pod can propose its own changes (add or remove cards, with reasons), members can nominate
ideas, and the result is shown as a separate **Pod view** line under the radar: "with our pod's list, this deck
would score …". The pod's list **never changes the main scores**; it is a side-by-side opinion.

## What users see

- Under the radar after charting (`005`): **Impact cards…** and "N of M default impact cards in this deck". Signed in
  with a pod that has changes: the **Pod view · <pod>** line with the proposed Power and Spark.
- **Impact cards** dialog: the default list and the pod's changes with reasons; a pod picker; ideas (candidate cards
  from the dataset, interleaved by source) to expand; a card search.
  - **Steward / Co-Steward**: toggle cards in or out, write a reason (Save / Skip), undo, **reset** (two clicks),
    accept or reject nominations, dismiss ideas and restore dismissed ones.
  - **Members**: nominate a card with a note and withdraw their own nomination.
  - **Signed out**: the read-only default list.
- A permission error says the Steward needs to publish the latest Firestore rules.

## How it works

- `index.ts`: `mount(ports)` listens to `chart:radar` and renders the caption into `#impactChart`
  (`mountImpactChart`); `refreshPodView` fills `#podViewLine`; `openImpactCardsModal` loads candidates lazily
  (a dialog dismissed while loading never reopens) and handles every action.
- `repository.ts`: `ImpactRepository` loads account-scoped state (pods, settings, nominations); a generation counter
  keeps the most recent pod when an older load finishes late, and sign-out clears it. Nomination-permission failures
  fall back to read-only and report.
- `state.ts`: pure helpers: effective list, consistent proposals, idea filtering and interleaving, and the proposed
  Power/Spark computed **without mutating** the standard analysis (uses `scorePowerLevel`, `computeSpark`).
- `view.ts`, `list-view.ts`, `ideas-view.ts`: templates (reasons escaped). `impact.css`, prefix `impact-`.

Ports (`ImpactPorts`, `runtime.ts`, from `src/app/impact.ts`): `analysis` (current chart from
`services/current-chart.ts`), `loadLibrary` (deck library, used for ranked search), `search` (`searchLoadedCards`).
Scroll anchoring comes from `ui/card-search`.

Events: listens to `chart:radar` (Deck Chart).

Data:

- Firestore (`src/services/cloud/impact.ts`; names exact): `pods/{podId}/settings/impactCards` = `changes` (map of
  `{ card, action: "add" | "remove", reason, by, byName, at, reasonBy, reasonAt }`), `dismissed` (map of
  `{ card, by, byName, at }`), `updatedAt`, `resetBy`; `pods/{podId}/impactNominations/{key}` =
  `{ card, note, by, byName, at }`.
- Datasets: the default list is curated in `src/data/impact-defaults.ts`; candidates are the lazy
  `public/data/IMPACT_CANDS.json`.
- Local storage `pm_impact_pod`: the last pod chosen in the dialog.

## Testing

- Unit: `impact.test.ts` (consistent proposals, idea filtering, scores computed on the side), `lifecycle.test.ts`
  (Steward toggle/reason/undo/reset, member nominations, Co-Steward accept/reject/restore, signed-out read-only,
  dismissed loading, pod-scoped writes), `repository.test.ts` (late loads, account switch, failed loads).
- Golden: proves the main scores ignore the pod list.
- e2e: `impact.spec.ts` (opens read-only, expands ideas, standard chart unchanged on reopen; dismissal during load),
  `lazy-data.spec.ts` (candidates load only when the dialog opens).
- By hand: chart a deck, press Impact cards…, expand ideas. As a Steward, remove a default card with a reason and
  check the Pod view line changes while the radar does not.

## Risks and rollback

A bug here can only affect the Pod view line and the pod's settings document, never the main scores. Roll back with
`git revert`; pod settings written meanwhile stay.

## Follow-ups

- The source for `IMPACT_CANDS.json` (`impact-cands.cjs`) is not in the repo yet; it is on the list of pieces to
  recover in `docs/refactor-plan/00-README.md`.

## Related

`004`, `005` (radar and `chart:radar`), `015` (pods and roles), `src/engine/CLAUDE.md` (Power scoring).
