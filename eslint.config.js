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
          ],
        },
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
