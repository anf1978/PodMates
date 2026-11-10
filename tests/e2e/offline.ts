import { test as base, expect } from "@playwright/test";

const firebaseModules: Record<string, string> = {
  "firebase-app.js": "export const initializeApp = () => ({});",
  "firebase-auth.js": `
    export const getAuth = () => ({});
    export const onAuthStateChanged = (_auth, callback) => {
      queueMicrotask(() => callback(null));
      return () => {};
    };
    export class GoogleAuthProvider {}
    export class OAuthProvider {}
    const unexpected = () => { throw new Error("Unexpected Firebase auth operation"); };
    export {
      unexpected as signOut, unexpected as signInWithPopup,
      unexpected as createUserWithEmailAndPassword, unexpected as signInWithEmailAndPassword,
      unexpected as sendPasswordResetEmail, unexpected as updateProfile
    };
  `,
  "firebase-firestore.js": `
    export const getFirestore = () => ({});
    const unexpected = () => { throw new Error("Unexpected Firestore operation"); };
    export {
      unexpected as doc, unexpected as setDoc, unexpected as updateDoc,
      unexpected as getDoc, unexpected as getDocs, unexpected as deleteDoc,
      unexpected as collection, unexpected as serverTimestamp, unexpected as query,
      unexpected as where, unexpected as arrayUnion, unexpected as arrayRemove,
      unexpected as getCountFromServer, unexpected as onSnapshot, unexpected as deleteField,
      unexpected as orderBy, unexpected as limit
    };
  `,
};

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

    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === new URL(baseURL!).origin) return route.continue();

      // Run the real cloud bridge with a signed-out SDK stub; no account or writes are created.
      if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
        const module = firebaseModules[url.pathname.split("/").pop()!];
        if (module) return route.fulfill({ contentType: "text/javascript", body: module });
      }
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
      if (request.resourceType() === "image") {
        return route.fulfill({ contentType: "image/svg+xml", body: placeholderImage });
      }
      if (url.hostname === "fonts.googleapis.com") {
        return route.fulfill({ contentType: "text/css", body: "" });
      }

      // Fail closed, including Firebase RPCs and deck-import/price APIs, without sending traffic.
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
