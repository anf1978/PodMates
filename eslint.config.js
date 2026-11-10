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
    files: legacyFiles,
    rules: Object.fromEntries(
      Object.entries(legacyRules).map(([name, setting]) => {
        const [severity, ...options] = Array.isArray(setting) ? setting : [setting];
        return [name, [severity === 0 || severity === "off" ? "off" : "warn", ...options]];
      }),
    ),
  },
);
