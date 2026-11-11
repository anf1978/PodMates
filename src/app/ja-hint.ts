// The Japanese-language hint at the top of the page: shown once to browsers set to Japanese
// (unless the page is already machine-translated), until it is dismissed.
export {};

const hint = document.getElementById("jaHint");
const dismiss = document.getElementById("jaHintClose");
try {
  const lang = (navigator.language || "").toLowerCase();
  let seen = false;
  try {
    seen = localStorage.getItem("pm_ja_hint") === "1";
  } catch {
    // Storage blocked: show it again next time.
  }
  if (
    hint &&
    lang.indexOf("ja") === 0 &&
    !seen &&
    !/translated/.test(document.documentElement.className || "")
  )
    hint.style.display = "block";
  dismiss?.addEventListener("click", () => {
    if (hint) hint.style.display = "none";
    try {
      localStorage.setItem("pm_ja_hint", "1");
    } catch {
      // Storage blocked: nothing to remember.
    }
  });
} catch {
  // A hint is never worth breaking the page for.
}
