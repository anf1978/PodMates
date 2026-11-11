// Export preserves import semantics for partners, duplicate commander entries and double-faced names.
import { expect, it } from "vitest";
import { buildExportText } from "./state";

it("writes partners once, retains quantities/full names, and round-trips section boundaries", () => {
  expect(
    buildExportText({
      commanders: ["Tymna the Weaver", "Thrasios, Triton Hero"],
      matched: [
        { qty: 1, card: { n: "TYMNA THE WEAVER" } },
        { qty: 1, card: { n: "Thrasios, Triton Hero" } },
        { qty: 1, card: { n: "Delver of Secrets // Insectile Aberration" } },
        { qty: 7, card: { n: "Forest" } },
      ],
    }),
  ).toBe(
    "Commander\n1 Tymna the Weaver\n1 Thrasios, Triton Hero\n\nDeck\n1 Delver of Secrets // Insectile Aberration\n7 Forest",
  );
});
