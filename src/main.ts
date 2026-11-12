// The page's one module entry. index.html is static markup and CSS; this boots the card data,
// then wires every feature through the composition root in src/app/ (one module per feature,
// imported for its side effects in this order, which keeps DOM listeners in their old order).
//
// The colour-theme pre-paint script is src/features/themes/prepaint.ts, inlined into <head> at
// build time because it must run before first paint. Nothing is published on `window`.

import "./app/page.ts";
import "./app/input-limits.ts";
import "./app/card-clicks.ts";
import "./app/deck-chart.ts";
import "./app/try-a-deck.ts";
import "./app/export.ts";
import "./app/card-viewer.ts";
import "./app/scan-cards.ts";
import "./app/deck-crafter.ts";
import "./app/impact.ts";
import "./app/spoiler-bait.ts";
import "./app/comparison.ts";
import "./app/trades.ts";
import "./app/pricescry.ts";
import "./app/profile.ts";
import "./app/auth.ts";
import "./app/gatherings.ts";
import "./app/chronicles.ts";
import "./app/saved-decks.ts";
import "./app/chronicles-auth.ts";
import "./app/pods.ts";
import "./app/ja-hint.ts";
import { installGlobalErrorHandlers } from "./services/report-error";
import { installStickyCloseNet } from "./ui/sticky-close";
import { mount as mountNotifications } from "./features/notifications";

installGlobalErrorHandlers();
installStickyCloseNet();
const authBar = document.getElementById("authBar");
if (authBar) mountNotifications(authBar);
