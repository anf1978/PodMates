// Rendering rules for every module: no raw HTML sinks (render lit templates from src/ui/html.ts)
// and an explained provenance for each trustedHtml() escape hatch.
export const renderingRules = {
  "no-unsanitized/property": "error",
  "no-unsanitized/method": "error",
  "no-restricted-properties": [
    "error",
    { object: "document", property: "write", message: "Use sanitized DOM rendering." },
    { object: "document", property: "writeln", message: "Use sanitized DOM rendering." },
  ],
};

export const trustedComment = {
  meta: { type: "problem", schema: [] },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "trustedHtml") return;
        const comments = context.sourceCode.getAllComments();
        if (
          !comments.some(
            (comment) =>
              comment.loc.end.line >= node.loc.start.line - 3 &&
              comment.loc.end.line <= node.loc.start.line &&
              /Trusted:\s+\S.+/i.test(comment.value),
          )
        ) {
          context.report({
            node,
            message: "Explain this raw HTML input in a nearby 'Trusted:' comment.",
          });
        }
      },
    };
  },
};

export const renderingPlugin = {
  rules: { "trusted-comment": trustedComment },
};
