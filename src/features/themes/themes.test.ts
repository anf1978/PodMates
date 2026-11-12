// Theme colour maths, pre-paint application and the Display settings tray.
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applyTextSize, applyTheme, currentTextSize, currentTheme, savedTheme } from "./apply";
import { auditThemes, buildTheme, contrastRatio, findTheme, THEME_VARS, THEMES } from "./palette";
import { themeSubtitle } from "./view";
import { mount } from "./index";

const toast = vi.hoisted(() => vi.fn());
vi.mock("../../ui/toast", () => ({ showToast: toast }));

const root = document.documentElement;
const stored = new Map<string, string>();
const storage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: vi.fn((key: string, value: string) => void stored.set(key, value)),
};
beforeEach(() => {
  stored.clear();
  storage.setItem.mockClear();
  vi.stubGlobal("localStorage", storage);
  root.removeAttribute("style");
  root.removeAttribute("data-pm-theme");
  root.removeAttribute("data-pm-text");
  document.head.innerHTML = '<meta name="theme-color" content="#0F0C0A">';
  document.body.replaceChildren();
  toast.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

it("keeps every theme's text and accents readable", () => {
  expect(auditThemes()).toEqual([]);
  expect(THEMES).toHaveLength(27);
  expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21);
});

it("computes the same colour values for every theme", () => {
  const values = Object.fromEntries(THEMES.map((t) => [t.id, buildTheme(t)]));
  expect(values.classic).toBeNull();
  for (const t of THEMES.filter((x) => x.colors))
    expect(Object.keys(values[t.id]!)).toEqual([...THEME_VARS]);
  expect(values).toMatchSnapshot();
});

it("names each colour combination", () => {
  expect(themeSubtitle(findTheme("izzet")!)).toBe("Blue / Red");
  expect(themeSubtitle(findTheme("jund")!)).toBe("Black / Red / Green · Ziatora's Proving Ground");
  expect(themeSubtitle(findTheme("wubrg")!)).toBe("All five colours");
});

it("applies, saves and clears a theme on the root element", () => {
  expect(applyTheme("izzet")).toBe("izzet");
  const izzet = buildTheme(findTheme("izzet"))!;
  expect(root.style.getPropertyValue("--bg-main")).toBe(izzet["--bg-main"]);
  expect(root.getAttribute("data-pm-theme")).toBe("izzet");
  expect(document.querySelector("meta")!.getAttribute("content")).toBe(izzet["--bg-main"]);
  expect(savedTheme()).toBe("izzet");
  expect(currentTheme()).toBe("izzet");

  expect(applyTheme("not-a-theme", true)).toBe("classic");
  for (const v of THEME_VARS) expect(root.style.getPropertyValue(v)).toBe("");
  expect(document.querySelector("meta")!.getAttribute("content")).toBe("#0F0C0A");
  expect(savedTheme()).toBe("izzet"); // silent: not saved
});

it("scales text, saves it and tells the radar to redraw", () => {
  const changed = vi.fn();
  window.addEventListener("pm-text-change", changed);
  expect(applyTextSize("1.3")).toBe("1.3");
  expect(root.style.getPropertyValue("zoom")).toBe("1.3");
  expect(root.style.getPropertyValue("--pm-zoom")).toBe("1.3");
  expect(currentTextSize()).toBe("1.3");
  expect(localStorage.getItem("pm-text-scale")).toBe("1.3");
  expect(changed).toHaveBeenCalledTimes(1);

  expect(applyTextSize("2", true)).toBe("1");
  expect(root.style.getPropertyValue("zoom")).toBe("");
  expect(root.getAttribute("data-pm-text")).toBe("1");
  expect(changed).toHaveBeenCalledTimes(1);
  window.removeEventListener("pm-text-change", changed);
});

it("pre-paint applies the saved choices without saving or announcing", async () => {
  stored.set("podmates-theme", "golgari");
  stored.set("pm-text-scale", "1.15");
  storage.setItem.mockClear();
  vi.resetModules();
  await import("./prepaint");
  expect(root.getAttribute("data-pm-theme")).toBe("golgari");
  expect(root.getAttribute("data-pm-text")).toBe("1.15");
  expect(storage.setItem).not.toHaveBeenCalled();
});

it("renders the tray and applies a theme or size when chosen", () => {
  applyTheme("classic", true);
  const host = document.createElement("div");
  document.body.append(host);
  mount(host);
  const tiles = host.querySelectorAll<HTMLElement>(".pm-theme-tile");
  expect(tiles).toHaveLength(27);
  expect(host.querySelectorAll('[role="radiogroup"]')).toHaveLength(6);
  expect(host.querySelector('[data-theme-id="classic"]')!.getAttribute("aria-checked")).toBe(
    "true",
  );
  expect(host.querySelector("b")!.textContent).toBe("Classic PodMates");

  host.querySelector<HTMLElement>('[data-theme-id="izzet"]')!.click();
  expect(currentTheme()).toBe("izzet");
  expect(localStorage.getItem("podmates-theme")).toBe("izzet");
  expect(host.querySelector('[data-theme-id="izzet"]')!.getAttribute("aria-checked")).toBe("true");
  expect(host.querySelector('[data-theme-id="classic"]')!.getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(host.querySelector("b")!.textContent).toBe("Izzet");
  expect(toast).toHaveBeenLastCalledWith("Izzet colours applied.");

  const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
  host.querySelector('[data-theme-id="wubrg"]')!.dispatchEvent(space);
  expect(space.defaultPrevented).toBe(true);
  expect(currentTheme()).toBe("wubrg");

  host.querySelector<HTMLButtonElement>('.pm-size-btn[data-size="1.5"]')!.click();
  expect(currentTextSize()).toBe("1.5");
  expect(host.querySelector('.pm-size-btn[data-size="1.5"]')!.getAttribute("aria-checked")).toBe(
    "true",
  );
  expect(toast).toHaveBeenLastCalledWith("Text size: Largest.");
});
