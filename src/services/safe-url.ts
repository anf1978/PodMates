// escapeHtml stops text breaking out of an HTML attribute, but it does NOT stop a link from
// running code: href="javascript:..." survives escaping untouched. Any link whose address came
// from a person (profile links, deck links) must pass through this first. It returns a clean
// http(s) address, or "" if the value isn't a real web link -- so callers simply skip the link.
// A bare "archidekt.com/u/name" gets https:// added, since that is the format the profile
// fields ask for.
export function safeHttpUrl(raw: unknown): string {
  let s = String(raw == null ? "" : raw).trim();
  if (!s) return "";
  // Browsers ignore tabs/newlines hidden inside a scheme ("java\tscript:"),
  // so strip control characters before looking at it.
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) s = "https://" + s.replace(/^\/+/, "");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return "";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  if (!u.hostname) return "";
  return u.href;
}
