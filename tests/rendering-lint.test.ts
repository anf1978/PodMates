import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

describe("rendering enforcement", () => {
  it.each([
    "node.innerHTML = input;",
    "node.outerHTML = input;",
    "node.insertAdjacentHTML('beforeend', input);",
    "document.write(input);",
    "document.writeln(input);",
  ])("rejects unsafe markup in JavaScript and inline scripts: %s", async (code) => {
    for (const [filePath, source] of [
      ["probe.js", code],
      ["index.html", `<!-- <script>not code</script> -->\n<script>${code}</script>`],
    ]) {
      const [result] = await eslint.lintText(source, { filePath });
      expect(
        result.messages.some(
          (message) =>
            message.ruleId?.startsWith("no-unsanitized") ||
            message.ruleId === "no-restricted-properties",
        ),
      ).toBe(true);
    }
  });

  it("allows literal and sanitized legacy markup, retaining original line numbers", async () => {
    const [result] = await eslint.lintText(
      "<div></div>\n<script>node.innerHTML = sanitizeHtml(input);</script>\n" +
        "<script>node.innerHTML = '<strong>Ready</strong>';</script>\n" +
        "<script>node.outerHTML = input;</script>",
      { filePath: "index.html" },
    );
    expect(result.messages.map(({ ruleId, line }) => ({ ruleId, line }))).toEqual([
      { ruleId: "no-unsanitized/property", line: 4 },
    ]);
  });

  it("requires a trust rationale for raw template markup", async () => {
    const [result] = await eslint.lintText(
      "trustedHtml(input);\n// Trusted: escaped names and constant markup.\ntrustedHtml(escaped);",
      { filePath: "probe.js" },
    );
    expect(
      result.messages.filter(({ ruleId }) => ruleId === "rendering/trusted-comment"),
    ).toHaveLength(1);
  });
});
