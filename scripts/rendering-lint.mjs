// Keep newlines and offsets so ESLint reports the original HTML lines. Classic
// scripts deliberately share a scope in this app; external scripts are checked separately.
export const inlineScripts = {
  preprocess(text) {
    let cursor = 0;
    let code = "";
    for (const match of text.matchAll(
      /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
    )) {
      if (match[0].startsWith("<!--")) continue;
      if (/\bsrc\s*=/i.test(match[1])) continue;
      const start = match.index + match[0].indexOf(">") + 1;
      code += text.slice(cursor, start).replace(/[^\r\n]/g, " ") + match[2];
      cursor = start + match[2].length;
    }
    return [code + text.slice(cursor).replace(/[^\r\n]/g, " ")];
  },
  postprocess(messages) {
    return messages.flat();
  },
};

export const renderingRules = {
  "no-unsanitized/property": ["error", { escape: { methods: ["sanitizeHtml"] } }],
  "no-unsanitized/method": ["error", { escape: { methods: ["sanitizeHtml"] } }],
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
  processors: { inline: inlineScripts },
  rules: { "trusted-comment": trustedComment },
};
