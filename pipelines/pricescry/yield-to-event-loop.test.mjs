import { stat } from "node:fs";
import { describe, expect, it } from "vitest";
import { yieldToEventLoop } from "./yield-to-event-loop.mjs";

const busy = (ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end);
};

describe("yieldToEventLoop", () => {
  it("runs a poll phase even when called from a poll-phase callback", async () => {
    // Vitest starts each file from a poll-phase callback (an IPC message). From there a single
    // setImmediate resolves before the next poll, so replies that arrived meanwhile stay unread.
    const delivered = await new Promise((resolve, reject) => {
      stat(".", (outerError) => {
        if (outerError) return reject(outerError);
        let innerDone = false;
        stat(".", () => {
          innerDone = true;
        });
        busy(200); // the inner stat completes on the thread pool and waits for the next poll
        yieldToEventLoop().then(() => resolve(innerDone), reject);
      });
    });
    expect(delivered).toBe(true);
  });
});
