// The error reporting the cloud bridge (api.ts) applies, for modules that call repositories
// directly. The wrapper is built per call, so importing this evaluates nothing.
import { reportOperation } from "../report-error";

/** A user-triggered cloud call: failures are reported and toasted, then rethrown. */
export const action =
  <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  (...args: A): Promise<R> =>
    reportOperation(fn, { operation: "cloud", userTriggered: true })(...args);

/** A background cloud read: failures are reported quietly, then rethrown. */
export const load =
  <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  (...args: A): Promise<R> =>
    reportOperation(fn, { operation: "cloud" })(...args);
