// "How was this built?" dialogs for every axis and panel, Spark's weighted breakdown, and the
// delegated clicks on [data-explain], [data-go-key-pieces] and Game Changer chips.

import { SPARK_WEIGHTS } from "../../../engine/spark.ts";
import { html, nothing, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { showInfoModal } from "../../../ui/info-modal.ts";
import { ordinal } from "../../../ui/format.ts";
import { centralityExplainer } from "../centrality/explainer.ts";
import type { Centrality } from "../centrality/panel.ts";
import { showCardReason } from "./card-text.ts";
import { contributorsFor, type ContribAgg } from "./contributors.ts";
import { EXPLAINERS } from "./explainer-text.ts";
import * as P from "./explainer-prose.ts";
import { bodyRow, bodyWrap, headRow, prose, section } from "./layout.ts";

/** The current chart and the reference-set helpers that still live in index.html. */
export interface ExplainerPorts {
  agg(): ContribAgg | null;
  winCons(): readonly { label: string }[] | null;
  scores(): Readonly<Record<string, number>> | null;
  commandSpark(): number | null;
  centrality(): Centrality | null;
  axes(): readonly { key: string; label: string }[];
  sparkPercentile(value: number): number;
  axisPercentile(key: string, value: number): number | null;
  tierPlacement(value: number, key?: string): string;
  referenceSummary(): string;
}

type Weights = Readonly<Record<string, number>>;

function sparkTable(
  ports: ExplainerPorts,
  scores: Readonly<Record<string, number>>,
  spark: number,
) {
  const W = SPARK_WEIGHTS as Weights;
  const axes = ports.axes();
  const rows = axes.map((a) => {
    const sc = scores[a.key] as number;
    const w = W[a.key] as number;
    return bodyRow([a.label, sc.toFixed(1), "×" + w, ((sc * w) / 5).toFixed(2)]);
  });
  const plain = axes.reduce((t, a) => t + (scores[a.key] as number), 0) / axes.length;
  const diff = spark - plain;
  const line =
    Math.abs(diff) < 0.05
      ? `For this deck, a plain average of the five axes (${plain.toFixed(1)}) lands in the same place, because its axes are fairly even.`
      : `A plain average of the five axes would read ${plain.toFixed(1)}. The extra weight on Power Level and Disruption moves it ${diff > 0 ? "up" : "down"} by ${Math.abs(diff).toFixed(1)} for this deck.`;
  // prettier-ignore
  return html`<table class="ex-table"><tbody>${headRow(["Axis", "This deck", "Weight", "Adds"])}${rows}<tr class="ex-total"><td class="ex-tot-first">Spark</td><td></td><td></td><td class="ex-tot-last">${spark.toFixed(1)}</td></tr></tbody></table><div class="ex-plain">${line}</div>`;
}

function sparkExplainer(ports: ExplainerPorts): TemplateResult {
  const scores = ports.scores();
  const spark = ports.commandSpark();
  const breakdown = scores && spark !== null ? sparkTable(ports, scores, spark) : nothing;
  const where =
    spark !== null
      ? section(
          "Where this deck sits",
          `Spark ${spark.toFixed(1)} is at the ${ordinal(ports.sparkPercentile(spark))} percentile of the PodMates reference set (${ports.referenceSummary()}). In tier terms, it scores higher than ${ports.tierPlacement(spark)}. That is a handy yardstick, but it is not a percentile of all Commander decks.`,
        )
      : nothing;
  // prettier-ignore
  return bodyWrap(html`<div>${prose(P.SP_INTRO)}</div>${section(P.SP_READ_TITLE, prose(P.SP_READ))}${section(P.SP_CALC_TITLE, html`${P.SP_CALC}${breakdown}`)}${section(P.SP_WEIGHTS_TITLE, prose(P.SP_WEIGHTS))}${section(P.SP_LIMITS_TITLE, prose(P.SP_LIMITS))}${where}`);
}

export function showExplainer(ports: ExplainerPorts, key: string): void {
  if (key === "commanderCentrality") {
    showInfoModal(
      html`<h2 class="ex-title">Commander Centrality</h2>`,
      centralityExplainer(ports.centrality()),
    );
    return;
  }
  if (key === "commandSpark") {
    showInfoModal(html`<h2 class="ex-title">What is Spark?</h2>`, sparkExplainer(ports));
    return;
  }
  const text = EXPLAINERS[key];
  if (!text) return;
  const contrib = contributorsFor(ports.agg(), ports.winCons(), key);
  const scores = ports.scores();
  let pct: TemplateResult | typeof nothing = nothing;
  if (scores && scores[key] !== undefined) {
    const value = scores[key] as number;
    const p = ports.axisPercentile(key, value);
    if (p !== null) {
      const label = ports.axes().find((a) => a.key === key)?.label;
      const line = `This deck's ${label} of ${value.toFixed(1)} sits at the ${ordinal(p)} percentile of the PodMates reference set (${ports.referenceSummary()}, not all Commander decks). It scores higher than ${ports.tierPlacement(value, key)}.`;
      pct = html`<div class="ex-pct">${line}</div>`;
    }
  }
  // Trusted: contributorsFor escapes every name and label (links via cardNameLinkHtml).
  const cards = contrib ? trustedHtml(contrib) : nothing;
  showInfoModal(
    html`<h2 class="ex-title">How was this built?</h2>`,
    html`${bodyWrap(html`${text}${cards}`)}${pct}`,
  );
}

/** Delegated clicks, in the order the inline handler used to check them. */
export function bindExplainerClicks(ports: ExplainerPorts, goToKeyPieces: () => void): void {
  document.addEventListener("click", (e) => {
    const target = e.target as Element | null;
    if (!target?.closest) return;
    if (target.closest("[data-go-key-pieces]")) return goToKeyPieces();
    const explain = target.closest("[data-explain]");
    if (explain) return showExplainer(ports, explain.getAttribute("data-explain") || "");
    // A card-face flip button wins over a chip around it (handled by the inline listener).
    if (target.closest("[data-flip-btn]")) return;
    const gc = target.closest("[data-gc-card]");
    if (gc) showCardReason(gc.getAttribute("data-gc-card") || "");
  });
}
