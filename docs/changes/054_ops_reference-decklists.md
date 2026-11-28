# 054: Store the tuned and cEDH reference decklists

Date: 2026-11-28

## Summary

The reference set that every percentile compares against holds 30 tuned decks and 20 cEDH tournament lists,
but their decklists were lost, so those 50 rows have been frozen since October and could never be re-scored.
This change sources all 50 lists again and commits them, with where each came from, when it was fetched and links
to primers, so they can't be lost again. Scores do not change yet. Swapping the frozen rows for these lists is a
separate, deliberate step, and it is needed before the planned Monte Carlo opening-hand work can recalibrate
Speed and Consistency.

## What users see

Nothing. `REFERENCE_SCORES` and `REFERENCE_TIERS` still use `frozen-reference-rows.json`.

## How it works

- `pipelines/reference-corpus/reference-decks.json` is the spec and the record: for each deck its tier
  (`t`/`c`), key, commander, hand-assigned archetype and, once fetched, its `source` (URL, kind, fetch date; for
  cEDH also the event, size, standing, record, date and the original TopDeck list), `cardCount`, and `primers`
  (title, URL, the cEDH Decklist Database entry and its date) or a `primerNote` saying why there are none.
- `pipelines/reference-corpus/decks/tuned/<key>.txt` and `decks/cedh/<key>.txt` hold the lists, one
  `N Card Name` line each, commanders first. All 50 have exactly 100 cards, and every card is recognised by
  the current card database.
- `fetch-reference-decks.mjs` rebuilds them (`NODE_USE_ENV_PROXY=1 node … [--only <key>] [--refresh]`). It
  leaves existing files alone unless `--refresh` is given, identifies itself with a PodMates User-Agent, waits
  2 s between requests, stops on 403 and throws on anything but a 100-card list.
- **Tuned:** the same 30 commanders as the October set (product bible Rev. 3.3), from EDHREC's "optimized"
  (Bracket 4) average decks (`json.edhrec.com/pages/average-decks/<slug>/optimized.json`).
- **cEDH:** the 20 most-played commanders on EDHTop16 (Popularity, last 6 months, 50+ player events, read
  2026-11-28). For each, the best finish on its commander page (last year, 50+ players): lowest standing, then
  the larger event, then the more recent. The October set's 20 commanders were not recorded, so this is a
  fresh, documented selection rather than a reconstruction. Player names are not stored.
- **Primers:** links from the cEDH Decklist Database's public data on GitHub, matched on the commander pair
  (17 of 20 cEDH decks have at least one; Ral, Nick Fury and Kefka have none listed). Only titles and links are
  stored: primers are their authors' writing and this repository is public, and Moxfield, where most are
  hosted, refuses automated requests. EDHREC average decks are statistical averages and have no primer.
- No data changes to `public/data/`.

## Testing

`fetch-reference-decks.test.mjs` tests the EDHTop16 entry and decklist parsers, the best-finish choice, the
EDHREC flattening, primer matching (partner pairs in either order), and that every deck in the manifest has a
committed 100-card list with a source and an archetype. No live calls.

Checked by hand with today's engine and card DB: 16 of the 30 tuned lists score exactly a frozen October
row (the other 14 EDHREC averages have drifted since), and 5 of the 20 cEDH lists do too (Sisay, Vivi, Nick
Fury, Crystal, Ob Nixilis). Tier medians are close: tuned Speed 7.05 (frozen 6.95), Consistency 7.0 (7.05);
cEDH Speed 9.5 (9.5), Consistency 6.95 (6.9), Versatility 7.65 (8.8).

## Risks and rollback

None to the site: nothing reads these files yet. Revert the commit to remove them.

## Follow-ups

- Replace `frozen-reference-rows.json` with rows scored from these lists in `benchmark-baselines.mjs`. That
  moves every percentile and tier placement, so it needs the owner's agreement and its own change doc.
- The Monte Carlo opening-hand research pass (standard, explained keep rule; tutors may fetch lands), then
  an `/engine-change` for Speed and Consistency calibrated on the full, re-scorable set.

## Related

`035` (reference-set builder and the frozen rows), product bible Rev. 3.3 (the October tiers).
