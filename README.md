# PodMates

PodMates is a web app for a regular *Magic: The Gathering* Commander playgroup: paste or import a decklist to get a
detailed deck profile (power, speed, bracket signals, combos, mana analysis), and use the social layer — pods,
game-night Gatherings, a shared match log, Impact-card votes and trades — to keep game nights fair and fun. It is a
single static page (`index.html`) served by GitHub Pages at **<https://anf1978.github.io/PodMates/>**. Project docs
live in [`docs/`](./docs/) (start with [`docs/overview.md`](./docs/overview.md) and
[`docs/refactor-plan.md`](./docs/refactor-plan.md)). Card and commander data are refreshed by weekly GitHub Actions
workflows ([`rebuild-card-database.yml`](./.github/workflows/rebuild-card-database.yml) and
[`rebuild-winrate-database.yml`](./.github/workflows/rebuild-winrate-database.yml), Mondays), which splice fresh
data into `index.html` on `main`. **How to contribute:** see [`CLAUDE.md`](./CLAUDE.md).
