// The page's one module entry. index.html loads it from <head>, so like every module it runs
// after the document is parsed and before DOMContentLoaded. The imports evaluate in this order,
// which the inline scripts rely on: UI primitives, feature adapters, engine, size limits,
// profile, auth, gatherings, cloud, then pods.
//
// The theme script and the card-database start-up are still inline in index.html; that code
// dynamically imports src/data/load-dataset.ts, src/cards/load-db.ts and the card/engine shims.
// Each legacy-globals.ts only republishes typed modules on window for the inline scripts and is
// deleted with its last inline caller. Add new behaviour to a typed module, not here.

import "./ui/legacy-globals.ts";
import "./features/deck-chart/legacy-globals.ts";
import "./features/try-a-deck/legacy-globals.ts";
import "./features/export/legacy-globals.ts";
import "./features/scan-cards/legacy-globals.ts";
import "./features/deck-crafter/legacy-globals.ts";
import "./features/impact/legacy-globals.ts";
import "./features/spoiler-bait/legacy-globals.ts";
import "./engine/legacy-globals.ts";
// Limits first and on their own, so local deck analysis keeps them even if Firebase fails.
import "./services/cloud/limits-global.ts";
import "./features/profile/legacy-globals.ts";
import "./features/auth/legacy-globals.ts";
import "./features/gatherings/legacy-globals.ts";
import "./features/chronicles/legacy-globals.ts";
// Publishes window.PodmatesCloud, then dispatches "podmates-cloud-init".
import "./services/cloud/index.ts";
import "./features/pods/legacy-globals.ts";
import { installGlobalErrorHandlers } from "./services/report-error";

installGlobalErrorHandlers();
