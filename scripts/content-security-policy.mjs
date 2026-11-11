import { createHash } from "node:crypto";

export function withScriptHashes(html) {
  const hashes = [...html.matchAll(/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(
      (match) => !match[0].startsWith("<!--") && !/\bsrc\s*=/i.test(match[1]) && match[2].trim(),
    )
    .map((match) => `'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`);
  return html.replace("__INLINE_SCRIPT_HASHES__", [...new Set(hashes)].join(" "));
}
