// The page's one module entry. index.html loads it from <head>, so like every module it runs
// after the document is parsed and before DOMContentLoaded. The imports evaluate in this order,
// which the inline scripts rely on: UI primitives, feature adapters, engine, size limits,
// profile, auth, gatherings, cloud, then pods.
//
// The colour-theme pre-paint script is src/features/themes/prepaint.ts, inlined into <head> at
// build time because it must run before first paint. The inline card-database adapter dynamically
// imports src/services/card-db-boot.ts; that service loads the DB, datasets and card/engine shims.
// Each legacy-globals.ts only republishes typed modules on window for the inline scripts and is
// deleted with its last inline caller. Add new behaviour to a typed module, not here.

import "./ui/legacy-globals.ts";
import "./features/deck-chart/legacy-globals.ts";
import "./features/try-a-deck/legacy-globals.ts";
import "./features/export/legacy-globals.ts";
import "./features/card-viewer/legacy-globals.ts";
import "./features/scan-cards/legacy-globals.ts";
import "./features/deck-crafter/legacy-globals.ts";
import "./features/impact/legacy-globals.ts";
import "./features/spoiler-bait/legacy-globals.ts";
import "./features/comparison/legacy-globals.ts";
import "./features/ledger/legacy-globals.ts";
import "./features/themes/legacy-globals.ts";
import "./features/trades/legacy-globals.ts";
import "./features/pricescry/legacy-globals.ts";
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
import { mount as mountNotifications } from "./features/notifications";

installGlobalErrorHandlers();
const authBar = document.getElementById("authBar");
if (authBar) mountNotifications(authBar);
