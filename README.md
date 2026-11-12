# PodMates

PodMates is a web app for a regular _Magic: The Gathering_ Commander playgroup: paste or import a decklist to get a
detailed deck profile (power, speed, bracket signals, combos, mana analysis), and use the social layer — pods,
game-night Gatherings, a shared match log, Impact-card votes and trades — to keep game nights fair and fun. It is a
single static page (`index.html`) served by GitHub Pages at **<https://anf1978.github.io/PodMates/>**. Project docs
live in [`docs/`](./docs/) (start with [`docs/overview.md`](./docs/overview.md) and
[`docs/refactor-plan.md`](./docs/refactor-plan.md)). Card and commander data are refreshed by weekly GitHub Actions
workflows ([`rebuild-card-database.yml`](./.github/workflows/rebuild-card-database.yml) and
[`rebuild-winrate-database.yml`](./.github/workflows/rebuild-winrate-database.yml), Mondays), which publish fresh
data to the `data` branch; each deploy assembles it with the app. **How to contribute:** see [`CLAUDE.md`](./CLAUDE.md);
day-to-day work happens from a phone in Claude cloud sessions whose `claude/` branches merge and deploy themselves once CI passes:
[`docs/phone-workflow.md`](./docs/phone-workflow.md). What changed and why: [`docs/changes/`](./docs/changes/README.md).
