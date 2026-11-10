import tseslint from "typescript-eslint";
import noUnsanitized from "eslint-plugin-no-unsanitized";

const legacyFiles = [
  ".github/scripts/**/*.mjs",
  "deck-link-sync-worker.js",
  "spellbook-compact-2026-11-10.mjs",
];
const recommended = tseslint.configs.recommended;
const legacyRules = Object.assign(
  {},
  ...recommended.map((config) => config.rules),
  noUnsanitized.configs.recommended.rules,
);

// Only the cloud layer may talk to Firebase; everything else goes through its repositories.
// Flat-config rule settings replace rather than merge, so every block that configures
// no-restricted-imports repeats these patterns.
const firebaseOnlyInCloud = {
  group: ["firebase", "firebase/*", "@firebase/*"],
  message: "Import Firebase only inside src/services/cloud/; use its repositories.",
};
// Templates go through src/ui/html.ts, so its trustedHtml() is the one audited way to
// insert raw markup.
const litHtmlOnlyViaUi = {
  group: ["lit-html", "lit-html/*"],
  message: "Import html/render from src/ui/html.ts instead of lit-html directly.",
};

// Layer boundary (refactor plan 4.2): the engine may import only its own files, the card
// modules, the static data tables and src/shared -- never features, the page or the dataset
// loader. `up` is the relative prefix from the linted folder back to src/.
function engineBoundary(files, up) {
  return [
    {
      files: [files],
      ignores: ["src/engine/legacy-globals.ts", "src/engine/**/*.test.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  `${up}*/**`,
                  `${up}../**`,
                  ...["cards", "data", "shared", "engine"].map((d) => `!${up}${d}/**`),
                ],
                message:
                  "src/engine may import only its own files, src/cards, src/data and src/shared.",
              },
              {
                group: [`${up}data/load-dataset*`],
                message: "The engine is pure; the app loads datasets and passes them in.",
              },
              firebaseOnlyInCloud,
              litHtmlOnlyViaUi,
            ],
          },
        ],
      },
    },
  ];
}

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", "public/**", "playwright-report/**", "test-results/**"],
  },
  ...recommended,
  {
    plugins: { "no-unsanitized": noUnsanitized },
    rules: noUnsanitized.configs.recommended.rules,
  },
  {
    ignores: ["src/services/cloud/**", "src/ui/html.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [firebaseOnlyInCloud, litHtmlOnlyViaUi] }],
    },
  },
  {
    files: ["src/services/cloud/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [litHtmlOnlyViaUi] }] },
  },
  {
    files: ["src/ui/html.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [firebaseOnlyInCloud] }] },
  },
  {
    // Layer boundary (refactor plan 4.2): src/cards is imported by the engine and the
    // features, so it may only reach sideways into its own folder or down into
    // src/shared. The dataset loader is the one documented exception, pending the
    // shared-code move in p5-3.
    files: ["src/cards/**/*.{ts,js,mjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*/**", "../../**", "!../shared/**", "!../data/load-dataset*"],
              message: "src/cards may import only its own files and src/shared.",
            },
            firebaseOnlyInCloud,
            litHtmlOnlyViaUi,
          ],
        },
      ],
    },
  },
  {
    // UI primitives are shared by every feature, so they depend on nothing above them.
    files: ["src/ui/**/*.{ts,js,mjs}"],
    ignores: ["src/ui/html.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*/**", "../../**", "!../shared/**"],
              message: "src/ui may import only its own files and src/shared.",
            },
            firebaseOnlyInCloud,
            litHtmlOnlyViaUi,
          ],
        },
      ],
    },
  },
  ...engineBoundary("src/engine/*.{ts,js,mjs}", "../"),
  ...engineBoundary("src/engine/axes/**/*.{ts,js,mjs}", "../../"),
  {
    // Static data tables sit below the engine and features.
    files: ["src/data/**/*.{ts,js,mjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../engine/**", "../features/**"],
              message: "src/data must not import the engine or features.",
            },
            firebaseOnlyInCloud,
            litHtmlOnlyViaUi,
          ],
        },
      ],
    },
  },
  {
    // The engine is pure (src/engine/CLAUDE.md): no page, storage or network access and no
    // module-level mutable state, so the same deck and context always give the same result.
    // The window shim is the one place allowed to touch the page.
    files: ["src/engine/**/*.ts"],
    ignores: ["src/engine/legacy-globals.ts", "src/engine/**/*.test.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...["window", "document", "globalThis", "self", "fetch", "localStorage", "sessionStorage"]
          .concat(["indexedDB", "navigator", "location", "XMLHttpRequest", "WebSocket", "Worker"])
          .map((name) => ({
            name,
            message: "The engine is pure; pass data in through EngineContext.",
          })),
      ],
      "no-restricted-syntax": [
        "error",
        ...[
          "Program > VariableDeclaration[kind!='const']",
          "Program > ExportNamedDeclaration > VariableDeclaration[kind!='const']",
        ].map((selector) => ({
          selector,
          message: "No module-level mutable state in the engine; keep caches on an EngineContext.",
        })),
      ],
    },
  },
  {
    files: legacyFiles,
    rules: Object.fromEntries(
      Object.entries(legacyRules).map(([name, setting]) => {
        const [severity, ...options] = Array.isArray(setting) ? setting : [setting];
        return [name, [severity === 0 || severity === "off" ? "off" : "warn", ...options]];
      }),
    ),
  },
);
