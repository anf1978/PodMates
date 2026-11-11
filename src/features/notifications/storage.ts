// Preserve the inbox's per-account device keys; storage failures remain non-blocking and reported.
import { reportError } from "../../services/report-error";
import type { Preferences } from "./state";

function storageFailure(error: unknown): void {
  reportError(error, { operation: "notifications", severity: "warning" });
}

export function save(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    storageFailure(error);
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    storageFailure(error);
    return null;
  }
}

function flags(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, flag]) => typeof flag === "boolean"));
}

export function load(uid: string, now: number): { seenAt: number; prefs: Preferences } {
  const seen = read("pm_notif_seen_" + uid);
  if (seen === null) save("pm_notif_seen_" + uid, String(now));
  let prefs: Preferences = { types: {}, muted: {} };
  try {
    const value: unknown = JSON.parse(read("pm_notif_prefs_" + uid) || "null");
    if (value && typeof value === "object" && !Array.isArray(value)) {
      prefs = {
        types: flags("types" in value ? value.types : null),
        muted: flags("muted" in value ? value.muted : null),
      };
    }
  } catch (error) {
    storageFailure(error);
  }
  return { seenAt: seen === null ? now : Number(seen) || 0, prefs };
}
