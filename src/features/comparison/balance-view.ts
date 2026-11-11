// Rule Zero table alignment and optional guidance, rendered without raw HTML.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { cardNameLink } from "../../ui/card-name";
import { buildBalanceNudges } from "./guidance";
import { buildPodMismatchNotes, type Note, type TableState } from "./state";

function linked(note: Note): unknown[] {
  const names = [...new Set(note.names.filter(Boolean))].sort((a, b) => b.length - a.length);
  const parts: unknown[] = [];
  let rest = note.text;
  while (rest) {
    const hits = names
      .map((name) => ({ name, index: rest.indexOf(name) }))
      .filter((hit) => hit.index >= 0)
      .sort((a, b) => a.index - b.index);
    if (!hits.length) {
      parts.push(rest);
      break;
    }
    const hit = hits[0];
    parts.push(rest.slice(0, hit.index), cardNameLink(hit.name));
    rest = rest.slice(hit.index + hit.name.length);
  }
  return parts;
}

export function balanceView(state: TableState): TemplateResult {
  const { decks, avgSpark, spread, label, detail, outliers } = state;
  const keys = decks.map((d) => d.bracket.bracketKey || d.bracket.bracket || "");
  const same = decks.length >= 2 && keys.every((key) => key && key === keys[0]);
  const spirits = [...new Set(decks.map((d) => d.bracket.spirit?.band || "?"))];
  const sameNote = `Everyone shares official bracket signals (${keys[0]}). Matching hinges on Spark (spread ${spread.toFixed(1)}) and spirit bands${spirits.length ? " — " + spirits.join(" / ") : ""}. Shape differences below matter more than the shared bracket label.`;
  const mismatches = buildPodMismatchNotes(decks),
    nudges = buildBalanceNudges(decks);
  return html`${same ? html`<div class="comparison-same"><strong>Same bracket band:</strong> ${sameNote}</div>` : nothing}
    <div class="comparison-alignment">
      <div class="comparison-alignment-copy">
        <div class="comparison-label">Table Alignment</div>
        <div class="comparison-balance-label">${label}</div>
        <div class="comparison-detail">${detail}</div>
      </div>
      <div class="comparison-stats">
        <div class="stat">
          <span class="num">${avgSpark.toFixed(1)}</span><span class="lbl">Avg Spark</span>
        </div>
        <div class="stat">
          <span class="num">${spread.toFixed(1)}</span><span class="lbl">Spread</span>
        </div>
        <div class="stat">
          <span class="num">${decks.length}</span><span class="lbl">Decks</span>
        </div>
      </div>
    </div>
    ${outliers.length ? html`<div class="comparison-outliers"><strong>Outliers:</strong> ${outliers.map((note, i) => html`${i ? " · " : ""}${linked(note)}`)}</div>` : nothing}
    ${
      mismatches.length
        ? html`<div class="comparison-mismatches">
            <strong>Feel mismatches:</strong>
            <ul>
              ${mismatches.map((note) => html`<li>${linked(note)}</li>`)}
            </ul>
          </div>`
        : nothing
    }
    ${
      nudges
        ? html`<div class="comparison-nudges">
            <div class="comparison-label">A Few Gentle Tweaks For Tonight</div>
            <p class="comparison-nudge-intro">
              Optional nudges for us as a pod — not homework. Small tweaks beat rebuilds. What we
              own and what we enjoy always come first.
            </p>
            ${
              nudges.skipReason
                ? html`<p class="comparison-skip">${nudges.skipReason}</p>`
                : html` ${
                    nudges.high
                      ? html`<div class="comparison-high">
                          <div class="comparison-nudge-title">
                            <strong>Nudge (ahead):</strong> ${nudges.high.label}
                            <span>${" · Spark " + nudges.high.spark.toFixed(1)}</span>
                          </div>
                          <ul>
                            ${nudges.high.nudges.map((text) => html`<li>${text}</li>`)}
                          </ul>
                        </div>`
                      : nothing
                  }
                  ${
                    nudges.low
                      ? html`<div>
                          <div class="comparison-nudge-title">
                            <strong>Hint (behind):</strong> ${nudges.low.label}
                            <span>${" · Spark " + nudges.low.spark.toFixed(1)}</span>
                          </div>
                          <ul>
                            ${nudges.low.hints.map((text) => html`<li>${text}</li>`)}
                          </ul>
                        </div>`
                      : nothing
                  }`
            }
          </div>`
        : nothing
    }`;
}
