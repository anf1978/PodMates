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
  ])("rejects unsafe markup in modules: %s", async (code) => {
    const [result] = await eslint.lintText(code, { filePath: "probe.js" });
    expect(
      result.messages.some(
        (message) =>
          message.ruleId?.startsWith("no-unsanitized") ||
          message.ruleId === "no-restricted-properties",
      ),
    ).toBe(true);
  });

  it("allows literal markup and flags every other sink, with no sanitizer escape left", async () => {
    const [result] = await eslint.lintText(
      "node.innerHTML = '';\nnode.innerHTML = sanitizeHtml(input);\nnode.outerHTML = input;",
      { filePath: "probe.js" },
    );
    expect(result.messages.map(({ ruleId, line }) => ({ ruleId, line }))).toEqual([
      { ruleId: "no-unsanitized/property", line: 2 },
      { ruleId: "no-unsanitized/property", line: 3 },
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
