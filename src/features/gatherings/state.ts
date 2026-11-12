// Pure gathering seat, invitation and landing-page state.
import type { Gathering } from "../../services/cloud/gatherings";
import type { GatheringSeat, SeatRsvp } from "../../services/cloud/types";

export const GATHERING_KEYS = ["0", "1", "2", "3", "4", "5"] as const;
export interface Member {
  uid: string;
  displayName?: string | null;
  displayLabel?: string;
}
export type Assignment = string | { guest: string } | null;
export type GatheringDetails = Pick<Partial<Gathering>, "whenDate" | "whenTime" | "place">;
export type LandingGathering = Gathering & { podId: string; podName?: string };

export function gatheringRsvpOf(seat?: GatheringSeat | null): SeatRsvp {
  return seat?.rsvp || "accepted";
}

export function gatheringWhenText(g?: GatheringDetails | null): string {
  const bits: string[] = [];
  if (g?.whenDate) {
    const p = String(g.whenDate).split("-").map(Number);
    const d = p.length === 3 && p[0] ? new Date(p[0], p[1] - 1, p[2]) : null;
    bits.push(
      d && !isNaN(d.getTime())
        ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
        : String(g.whenDate),
    );
  }
  if (g?.whenTime) bits.push(String(g.whenTime));
  if (g?.place) bits.push(String(g.place));
  return bits.join(" · ");
}

export function gatheringIsStale(g: Gathering | null, now = Date.now()): boolean {
  if (!g || g.status !== "proposed") return false;
  if (g.whenDate) {
    const p = String(g.whenDate).split("-").map(Number);
    if (p.length === 3 && p[0])
      return now > new Date(p[0], p[1] - 1, p[2]).getTime() + 2 * 86400000;
  }
  return now - (g.createdAt || now) > 7 * 86400000;
}

type NewSeat = GatheringSeat & { uid: string; displayName: string };
export function gatheringNewGuestSeat(name: string, index: string | number): NewSeat {
  return {
    uid: "guest:" + Date.now().toString(36) + index,
    displayName: String(name).trim().slice(0, 40),
    guest: true,
    deck: null,
    rsvp: "accepted",
  };
}

export function occupied(g: Gathering): Array<{ k: string; s: GatheringSeat & { uid: string } }> {
  return GATHERING_KEYS.flatMap((k) => {
    const s = g.seats?.[k];
    return s?.uid ? [{ k, s: { ...s, uid: s.uid } }] : [];
  });
}

export interface CollectedSeats {
  seats: Record<string, NewSeat>;
  invitees: string[];
  inviteeNames: string[];
  guestNames: string[];
  count: number;
}

export function collectSeats(
  assignments: Assignment[],
  members: Member[],
  mode: "invite" | "now",
): CollectedSeats | { error: string } {
  const result: CollectedSeats = {
    seats: {},
    invitees: [],
    inviteeNames: [],
    guestNames: [],
    count: 1,
  };
  for (let i = 1; i < 6; i++) {
    const a = assignments[i];
    if (!a) continue;
    if (typeof a === "object") {
      const name = a.guest.trim();
      if (!name) return { error: `Seat ${i + 1} is a guest seat with no name yet.` };
      result.seats[i] = gatheringNewGuestSeat(name, i);
      result.guestNames.push(name);
    } else {
      const m = members.find((m) => m.uid === a);
      const name = m?.displayLabel || m?.displayName || "Podmate";
      result.seats[i] = {
        uid: a,
        displayName: name,
        deck: null,
        rsvp: mode === "invite" ? "invited" : "accepted",
      };
      if (mode === "invite") {
        result.invitees.push(a);
        result.inviteeNames.push(name);
      }
    }
    result.count++;
  }
  return result;
}

export function restoreLineup(saved: unknown[], members: Member[], hostUid: string): Assignment[] {
  const result: Assignment[] = [hostUid, null, null, null, null, null];
  for (let i = 1; i < 6; i++) {
    const s = saved[i];
    if (!s || typeof s !== "object") continue;
    if ("guest" in s && s.guest && "displayName" in s && s.displayName)
      result[i] = { guest: String(s.displayName) };
    else if ("uid" in s && typeof s.uid === "string" && members.some((m) => m.uid === s.uid))
      result[i] = s.uid;
  }
  return result;
}

export function gatheringSignature(g: Gathering | null): string {
  return g
    ? JSON.stringify([
        g.status,
        g.chartedAt,
        g.lastLoggedChronicleId,
        g.seats,
        g.title,
        g.whenDate,
        g.whenTime,
        g.place,
      ])
    : "gone";
}
