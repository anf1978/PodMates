import { showToast } from "../ui/toast";

export interface ErrorContext {
  // Deliberately closed: callers cannot accidentally log URLs, document paths or user input.
  operation:
    | "cloud"
    | "authentication"
    | "deck-sync"
    | "offline-cache"
    | "app-update"
    | "card-database"
    | "card-art"
    | "deck-library"
    | "deck-export"
    | "card-scan"
    | "deck-crafter"
    | "gatherings"
    | "global-error"
    | "unhandled-rejection";
  userTriggered?: boolean;
  severity?: "warning" | "error";
}

type Report = {
  operation: ErrorContext["operation"];
  kind: string;
  severity: "warning" | "error";
};
type Seen = { logged: boolean; toasted: boolean };
const objects = new WeakMap<object, Seen>();
const primitives = new Map<unknown, { state: Seen; time: number }>();
const installed = new WeakSet<Window>();
const MESSAGE = "Something went wrong. Please try again.";

function stateFor(err: unknown): Seen {
  if ((typeof err === "object" && err !== null) || typeof err === "function") {
    let state = objects.get(err);
    if (!state) objects.set(err, (state = { logged: false, toasted: false }));
    return state;
  }
  const now = Date.now();
  const previous = primitives.get(err);
  if (previous && now - previous.time < 1000) return previous.state;
  if (primitives.size >= 50) primitives.clear();
  const state = { logged: false, toasted: false };
  primitives.set(err, { state, time: now });
  return state;
}

function normalize(err: unknown, context: ErrorContext): Report {
  // Never send messages, stacks, arbitrary codes or the original object to a sink.
  let kind = "unknown";
  try {
    if (err instanceof TypeError) kind = "network-or-type";
    else if (err instanceof Error) kind = "error";
    const code = (err as { code?: unknown } | null)?.code;
    if (code === "permission-denied" || code === "unavailable" || code === "not-found") kind = code;
    else if (typeof code === "string" && code.startsWith("auth/")) kind = "authentication";
  } catch {
    // Even an opaque thrown object with throwing getters must be safe to report.
  }
  return { operation: context.operation, kind, severity: context.severity ?? "error" };
}

/** The single reporting sink; a future remote adapter must receive only this redacted record. */
function publish(report: Report): void {
  const line = `[PodMates] ${report.operation} failed (${report.kind}).`;
  if (report.severity === "warning") console.warn(line);
  else console.error(line);
}

export function reportError(err: unknown, context: ErrorContext): void {
  const state = stateFor(err);
  if (!state.logged) {
    state.logged = true;
    publish(normalize(err, context));
  }
  if (context.userTriggered && !state.toasted) {
    state.toasted = true;
    if (typeof document !== "undefined" && document.body) showToast(MESSAGE);
  }
}

/** Keep the same arguments, resolution and rejection object at an asynchronous boundary. */
export function reportOperation<A extends unknown[], R>(
  operation: (...args: A) => Promise<R>,
  context: ErrorContext,
): (...args: A) => Promise<R> {
  return async (...args) => {
    try {
      return await operation(...args);
    } catch (err) {
      reportError(err, context);
      throw err;
    }
  };
}

export function installGlobalErrorHandlers(target: Window = window): void {
  if (installed.has(target)) return;
  installed.add(target);
  target.addEventListener("error", (event) => {
    reportError(event.error ?? event, { operation: "global-error" });
  });
  target.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { operation: "unhandled-rejection" });
  });
}
