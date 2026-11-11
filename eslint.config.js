import tseslint from "typescript-eslint";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import { renderingPlugin, renderingRules } from "./scripts/rendering-lint.mjs";

const legacyFiles = [
  "pipelines/**/*.mjs",
  "deck-link-sync-worker.js",
  "spellbook-compact-2026-11-10.mjs",
];
const recommended = tseslint.configs.recommended;

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

// Services (and the cloud repositories) never import a feature or the composition root.
const servicesLayer = {
  group: ["../features/**", "../../features/**", "../app/**", "../../app/**"],
  message: "Services must not import features or src/app; pass behaviour in through ports.",
};

// Layer boundary (refactor plan 4.2): the engine may import only its own files, the card
// modules, the static data tables and src/shared -- never features, the page or the dataset
// loader. `up` is the relative prefix from the linted folder back to src/.
function engineBoundary(files, up) {
  return [
    {
      files: [files],
      ignores: ["src/engine/**/*.test.ts"],
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
  ...recommended.map((config) => ({
    ...config,
    ignores: [...(config.ignores ?? []), "**/*.html"],
  })),
  {
    plugins: { "no-unsanitized": noUnsanitized },
    rules: renderingRules,
  },
  {
    plugins: { rendering: renderingPlugin },
    rules: { "rendering/trusted-comment": "error" },
  },
  {
    ignores: ["src/services/cloud/**", "src/ui/html.ts", "firebase/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [firebaseOnlyInCloud, litHtmlOnlyViaUi] }],
    },
  },
  {
    files: ["firebase/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [litHtmlOnlyViaUi] }] },
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
    // The main-thread DB failure boundary reports once; worker/codec/lookup stay service-free.
    files: ["src/cards/load-db.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "../*/**",
                "../../**",
                "!../shared/**",
                "!../data/load-dataset*",
                "!../services/report-error",
              ],
              message: "Only load-db may use the shared error-reporting boundary.",
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
  {
    // Features own one area of the app each. A feature may use the UI primitives, the
    // engine, the card modules, the cloud repositories and the static data -- but never
    // another feature, so the boundaries stay one-way and each can move on its own.
    files: ["src/features/**/*.{ts,js,mjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../features/*/**", "../../../features/*/**"],
              message: "Features must not import each other; lift shared code into src/ui.",
            },
            {
              group: ["../../app/**", "../../../app/**", "../../../../app/**"],
              message: "Features receive their ports from src/app; never import it.",
            },
            firebaseOnlyInCloud,
            litHtmlOnlyViaUi,
          ],
        },
      ],
    },
  },
  {
    // Services sit below the features and the composition root (src/app), which wires features
    // to each other; a service never reaches up into either.
    files: ["src/services/**/*.{ts,js,mjs}"],
    ignores: ["src/services/cloud/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [servicesLayer, firebaseOnlyInCloud, litHtmlOnlyViaUi] },
      ],
    },
  },
  {
    files: ["src/services/cloud/**/*.{ts,js,mjs}"],
    rules: { "no-restricted-imports": ["error", { patterns: [servicesLayer, litHtmlOnlyViaUi] }] },
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
              group: ["../engine/**", "../features/**", "../app/**"],
              message: "src/data must not import the engine, features or src/app.",
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
    files: ["src/engine/**/*.ts"],
    ignores: ["src/engine/**/*.test.ts"],
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
    // Hand-written files stay small (refactor plan 5.2). Curated data tables are exempt.
    files: ["src/**/*.{ts,js,mjs}", "tests/**/*.{ts,js,mjs}"],
    ignores: ["src/data/**"],
    rules: {
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // No globals: modules import what they need instead of reading or writing `window`.
    files: ["src/**/*.{ts,js,mjs}"],
    ignores: ["src/**/*.test.ts", "src/engine/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "AssignmentExpression > MemberExpression.left[object.name=/^(window|globalThis|self)$/]:not([property.name=/^on/])",
          message: "No new globals; export the value from a module instead.",
        },
        {
          selector:
            "CallExpression[callee.object.name='Object'][callee.property.name='assign'] > Identifier.arguments:first-child[name=/^(window|globalThis|self)$/]",
          message: "No new globals; export the value from a module instead.",
        },
      ],
    },
  },
  {
    // Pipelines, the deck-sync Worker and the one-off Spellbook script are plain JavaScript.
    // The recommended rules are errors here too; unused parameters and ignored catch bindings are
    // allowed because they document the call shape, and `cond ? a++ : b++` is the self-tests' idiom.
    files: legacyFiles,
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "@typescript-eslint/no-unused-expressions": ["error", { allowTernary: true }],
    },
  },
);
