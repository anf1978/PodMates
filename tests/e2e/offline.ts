import { test as base, expect } from "@playwright/test";

const placeholderImage =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="#333"/></svg>';

export const test = base.extend({
  page: async ({ page, context, baseURL }, use) => {
    const errors: string[] = [];
    const unexpectedRequests: string[] = [];
    // No console-error allow-list: all third-party dependencies are fulfilled locally.
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    await context.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        console.error(`CSP violation: ${event.effectiveDirective} ${event.blockedURI}`);
      });
    });

    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === new URL(baseURL!).origin) return route.continue();

      if (url.hostname === "api.scryfall.com" && url.pathname === "/cards/named") {
        return route.fulfill({
          json: { image_uris: { normal: "https://cards.scryfall.io/e2e-placeholder.svg" } },
        });
      }
      if (url.hostname === "api.scryfall.com" && url.pathname === "/cards/collection") {
        const payload: { identifiers: { name: string }[] } = request.postDataJSON();
        return route.fulfill({
          json: {
            data: payload.identifiers.map(({ name }) => ({
              name,
              image_uris: { normal: "https://cards.scryfall.io/e2e-placeholder.svg" },
            })),
          },
        });
      }
      if (request.resourceType() === "image" || url.hostname === "cards.scryfall.io") {
        return route.fulfill({ contentType: "image/svg+xml", body: placeholderImage });
      }
      if (url.hostname === "fonts.googleapis.com") {
        return route.fulfill({ contentType: "text/css", body: "" });
      }

      // Fail closed without sending traffic. The bundled Firebase SDK runs for real but signed out,
      // so any Firebase RPC here (auth, Firestore) is unexpected, as are deck-import/price APIs.
      unexpectedRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort("blockedbyclient");
    });

    try {
      await use(page);
    } finally {
      expect.soft(unexpectedRequests, "Unexpected external requests").toEqual([]);
      expect.soft(errors, "Browser errors (no allow-listed exceptions)").toEqual([]);
    }
  },
});

export { expect } from "@playwright/test";
