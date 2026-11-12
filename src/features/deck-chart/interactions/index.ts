// Public surface of the interaction reading ("Card Links & Packages" in the Synergy panel) and
// the "Cards you could add" sheet. Display only: nothing here feeds a score.

export { buildInteractionPackages } from "./reading.ts";
export { ixDescribePackage } from "./describe.ts";
export { ixThinSpots } from "./knowledge.ts";
export { buildInteractionSuggestions } from "./suggestions.ts";
export { setSuggestionContext, showSuggestions, type SuggestionPorts } from "./sheet.ts";
export type * from "./types.ts";
