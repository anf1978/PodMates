// Escaped templates for every library screen; callbacks own navigation and deck selection.
import { html, type TemplateResult } from "../../ui/html";
import {
  ARCHETYPE_BLURBS,
  archetypes,
  decksAt,
  preconYears,
  styles,
  type Location,
  type SampleDeck,
} from "./state";

export interface Actions {
  close(): void;
  back(): void;
  navigate(location: Location): void;
  select(deck: SampleDeck): void;
}

function countText(count: number, noun = "deck"): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function home(decks: readonly SampleDeck[], actions: Actions): TemplateResult {
  const precons = decks.filter((deck) => deck.source === "precon").length;
  const total = precons + decks.filter((deck) => deck.source === "curated").length;
  const archetypeCount = archetypes(decks).length;
  return html`<div class="tad-category-grid">
    <button
      class="tad-category-card"
      data-tad-action="goto-archetype-list"
      @click=${() => actions.navigate({ view: "archetype-list" })}
    >
      <div class="tad-cat-title">Browse by Archetype</div>
      <div class="tad-cat-desc">
        ${`Every deck sorted into one of ${archetypeCount} core strategy skeletons -- Voltron, Aristocrats, Spellslinger, and more -- so you can find the plan you want, not just the colors.`}
      </div>
      <div class="tad-cat-count">${`${total} decks across ${archetypeCount} archetypes`}</div>
    </button>
    <button
      class="tad-category-card"
      data-tad-action="goto-year-list"
      @click=${() => actions.navigate({ view: "year-list" })}
    >
      <div class="tad-cat-title">Browse Precon Releases</div>
      <div class="tad-cat-desc">
        Official Commander precons, organized by release year and set -- starting from 2011.
      </div>
      <div class="tad-cat-count">${`${countText(precons, "precon")} so far`}</div>
    </button>
    <button
      class="tad-category-card tad-category-card-minor"
      data-tad-action="goto-style-list"
      @click=${() => actions.navigate({ view: "style-list" })}
    >
      <div class="tad-cat-title">Browse by Exact Style</div>
      <div class="tad-cat-desc">
        Every deck's specific color-pair label, if you already know exactly what you're looking for.
      </div>
      <div class="tad-cat-count">${`${total} decks across ${styles(decks).length} styles`}</div>
    </button>
  </div>`;
}

function deckButton(deck: SampleDeck, actions: Actions, hideArchetype = false, blend = false) {
  const label = blend
    ? `Primary: ${deck.archetype} · ${deck.style}`
    : `${hideArchetype ? "" : deck.archetype + " · "}${deck.style}${deck.source === "precon" ? " · " + deck.setName : " · curated example"}`;
  return html`<button
    class=${blend ? "tad-option tad-option-blend" : "tad-option"}
    data-tad-action="load"
    data-tad-key=${deck.key}
    @click=${() => actions.select(deck)}
  >
    <div class="tad-name">${deck.flavorName}</div>
    <div class="tad-style">${label}</div>
    <div class="tad-tagline">${deck.tagline}</div>
    <div class="tad-commander">${`Commander: ${deck.commander}`}</div>
  </button>`;
}

function screen(
  decks: readonly SampleDeck[],
  location: Location,
  actions: Actions,
): {
  crumb: string;
  body: TemplateResult | TemplateResult[];
} {
  switch (location.view) {
    case "home":
      return { crumb: "", body: home(decks, actions) };
    case "archetype-list":
      return {
        crumb: "By Archetype",
        body: html`<div class="tad-list">
          ${archetypes(decks).map((name) => {
            const count = decks.filter((deck) => deck.archetype === name).length;
            const blends = decks.filter(
              (deck) => deck.archetype !== name && deck.archetypeAlso?.includes(name),
            ).length;
            return html`<button
              class="tad-nav-row tad-archetype-row"
              data-tad-action="goto-archetype"
              data-tad-archetype=${name}
              @click=${() => actions.navigate({ view: "archetype-decks", archetype: name })}
            >
              <span class="tad-nav-label">${name}</span>
              <span class="tad-archetype-blurb">${ARCHETYPE_BLURBS[name] || ""}</span>
              <span class="tad-nav-count"
                >${countText(count)}${
                  blends
                    ? html` <span class="tad-blend-hint"
                        >${`+${blends} blend${blends === 1 ? "" : "s"} in`}</span
                      >`
                    : ""
                }</span
              >
            </button>`;
          })}
        </div>`,
      };
    case "style-list":
      return {
        crumb: "By Style",
        body: html`<div class="tad-list">
          ${styles(decks).map(
            (style) =>
              html`<button
                class="tad-nav-row"
                data-tad-action="goto-style"
                data-tad-style=${style}
                @click=${() => actions.navigate({ view: "style-decks", style })}
              >
                <span class="tad-nav-label">${style}</span>
                <span class="tad-nav-count"
                  >${countText(decks.filter((deck) => deck.style === style).length)}</span
                >
              </button>`,
          )}
        </div>`,
      };
    case "year-list":
      return {
        crumb: "By Precon Release",
        body: html`<div class="tad-list">
          ${preconYears(decks).map(
            (year) =>
              html`<button
                class="tad-nav-row"
                data-tad-action="goto-year"
                data-tad-year=${year}
                @click=${() => actions.navigate({ view: "set-list", year })}
              >
                <span class="tad-nav-label">${year}</span>
                <span class="tad-nav-count"
                  >${countText(decks.filter((deck) => deck.source === "precon" && deck.year === year).length)}</span
                >
              </button>`,
          )}
        </div>`,
      };
    case "set-list": {
      const precons = decks.filter(
        (deck) => deck.source === "precon" && deck.year === location.year,
      );
      return {
        crumb: `By Precon Release / ${location.year}`,
        body: html`<div class="tad-list">
          ${[...new Set(precons.map((deck) => deck.setName))].map(
            (setName) =>
              html`<button
                class="tad-nav-row"
                data-tad-action="goto-set"
                data-tad-year=${location.year}
                data-tad-set=${setName}
                @click=${() => actions.navigate({ view: "set-decks", year: location.year, setName: setName ?? "" })}
              >
                <span class="tad-nav-label">${setName}</span>
                <span class="tad-nav-count"
                  >${countText(precons.filter((deck) => deck.setName === setName).length)}</span
                >
              </button>`,
          )}
        </div>`,
      };
    }
    case "archetype-decks": {
      const blends = decks.filter(
        (deck) =>
          deck.archetype !== location.archetype && deck.archetypeAlso?.includes(location.archetype),
      );
      return {
        crumb: `By Archetype / ${location.archetype}`,
        body: html`${decksAt(decks, location).map((deck) => deckButton(deck, actions, true))}
        ${
          blends.length
            ? html`<div class="tad-blend-divider">Also blends this in</div>
                <div class="tad-blend-list">
                  ${blends.map((deck) => deckButton(deck, actions, false, true))}
                </div>`
            : ""
        }`,
      };
    }
    case "style-decks":
    case "set-decks":
      return {
        crumb:
          location.view === "style-decks"
            ? `By Style / ${location.style}`
            : `By Precon Release / ${location.year} / ${location.setName}`,
        body: decksAt(decks, location).map((deck) => deckButton(deck, actions)),
      };
  }
}

export function loadingTemplate(close: () => void, message = "Loading..."): TemplateResult {
  return html`<button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <h2>Try a Deck</h2>
    <p class="tad-loading">${message}</p>`;
}

export function libraryTemplate(
  decks: readonly SampleDeck[],
  location: Location,
  actions: Actions,
): TemplateResult {
  const { crumb, body } = screen(decks, location, actions);
  return html`<button class="tad-close" id="tadCloseBtn" @click=${actions.close}>Close ×</button>
    <h2>Try a Deck</h2>
    ${
      crumb
        ? html`<div class="tad-breadcrumb">
            <button class="tad-back" id="tadBackBtn" @click=${actions.back}>‹ Back</button>
            <span class="tad-crumb">${crumb}</span>
          </div>`
        : html`<p class="tad-sub">
            Pick a curated example to see how the app reads different archetypes, or browse real
            precon decklists by release.
          </p>`
    }
    ${body}`;
}
