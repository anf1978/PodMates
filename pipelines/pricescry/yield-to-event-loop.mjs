/**
 * Test helper for the CPU-bound PriceScry simulation tests.
 *
 * The Vitest worker reports progress to the main process with RPC calls that fail after 60 s
 * ("[vitest-worker]: Timeout calling onTaskUpdate"). Replies are only read in the event loop's
 * poll phase, and the timeout timers run in the timers phase *before* poll. A long synchronous
 * stretch can therefore leave a reply that has already arrived unread until its timer has expired.
 *
 * A single `setImmediate` is not enough: when called from a poll-phase callback (which is how the
 * worker starts a test file) it resolves in the same iteration's check phase, skipping poll. An
 * immediate queued from inside the check phase always waits for the next iteration, so two nested
 * immediates guarantee that one full poll phase runs before the promise resolves.
 *
 * Call this between simulations so that no synchronous stretch comes near the RPC timeout.
 *
 * @returns {Promise<void>}
 */
export const yieldToEventLoop = () =>
  new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
