import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { withScriptHashes } from "../scripts/content-security-policy.mjs";

it("hashes exact final inline script bytes, excluding external scripts and HTML comments", () => {
  const script = "\nimport('./assets/cards-final.js');\n";
  const html =
    "__INLINE_SCRIPT_HASHES__<!-- <script>not executable</script> -->" +
    `<script>${script}</script><script src="./external.js"></script><script>${script}</script>`;
  const result = withScriptHashes(html);
  const hash = createHash("sha256").update(script).digest("base64");
  expect(result.startsWith(`'sha256-${hash}'<!--`)).toBe(true);
  expect(result).not.toContain("__INLINE_SCRIPT_HASHES__");
  expect(result.match(/sha256-/g)).toHaveLength(1);
});
