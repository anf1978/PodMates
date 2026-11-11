// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createCloudApi } from "./api";
import { countDocs } from "./shared";
import { logActivity } from "./activity";
import * as fb from "./testing/fake-firebase";
import * as toast from "../../ui/toast";

vi.mock("./firebase", () => import("./testing/fake-firebase"));

beforeEach(() => {
  vi.useFakeTimers();
  fb.fake.reset();
  fb.fake.signIn({ uid: "private-user" });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(toast, "showToast");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it.each(["http", "network", "invalid-json"] as const)(
  "reports deck sync %s failure once while preserving the failure-result API",
  async (kind) => {
    const fetch = vi.fn();
    if (kind === "network") fetch.mockRejectedValue(new TypeError("private URL"));
    else if (kind === "invalid-json") fetch.mockResolvedValue(new Response("not JSON"));
    else fetch.mockResolvedValue(Response.json({ error: "Source unavailable" }, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const result = await createCloudApi().addLinkedDeck("https://private.example/deck");
    expect(result).toMatchObject({ ok: false, error: expect.any(String) });
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[PodMates\] deck-sync failed \([\w-]+\)\.$/),
    );
    expect(toast.showToast).toHaveBeenCalledOnce();
  },
);

it("reports auth failure results without credentials or raw messages", async () => {
  vi.mocked(fb.signInWithEmailAndPassword).mockRejectedValueOnce({
    code: "auth/network-request-failed",
    message: "private@example.test secret-password",
  });
  await expect(
    createCloudApi().logInWithEmail("private@example.test", "secret-password"),
  ).resolves.toEqual({
    ok: false,
    error: "Network error -- check your connection and try again.",
  });
  expect(console.error).toHaveBeenCalledExactlyOnceWith(
    "[PodMates] authentication failed (authentication).",
  );
  expect(toast.showToast).toHaveBeenCalledOnce();
});

it("reports rejected cloud actions without replacing their rejection", async () => {
  const err = Object.assign(new Error("users/private-user/trades/private"), {
    code: "permission-denied",
  });
  vi.spyOn(fb, "deleteDoc").mockRejectedValueOnce(err);
  await expect(createCloudApi().deleteTrade("private")).rejects.toBe(err);
  expect(console.error).toHaveBeenCalledExactlyOnceWith(
    "[PodMates] cloud failed (permission-denied).",
  );
  expect(toast.showToast).toHaveBeenCalledOnce();
});

it("reports read failures without a background toast", async () => {
  const err = new Error("private");
  vi.spyOn(fb, "getDocs").mockRejectedValueOnce(err);
  await expect(createCloudApi().loadTrades()).rejects.toBe(err);
  expect(console.error).toHaveBeenCalledOnce();
  expect(toast.showToast).not.toHaveBeenCalled();
});

it("preserves best-effort counts, activity writes and listener fallback behavior", async () => {
  vi.spyOn(fb, "getCountFromServer").mockRejectedValueOnce(new Error("private query"));
  await expect(countDocs(fb.collection(fb.db, "pods") as never)).resolves.toBe(0);
  vi.spyOn(fb, "setDoc").mockRejectedValueOnce(new Error("private activity"));
  await expect(
    logActivity("deck", "private title", { podIds: ["private"] }),
  ).resolves.toBeUndefined();
  fb.fake.failSnapshots(new Error("private listener"));
  const api = createCloudApi();
  const items = vi.fn();
  const onError = vi.fn();
  const stop = api.watchActivity("private", items);
  api.watchGathering("private", "private", vi.fn(), onError);
  expect(stop).toBeTypeOf("function");
  expect(items).toHaveBeenCalledWith([]);
  expect(onError).toHaveBeenCalledOnce();
  // Both listeners see the same SDK error; it is logged just once.
  expect(console.error).toHaveBeenCalledTimes(3);
  expect(toast.showToast).not.toHaveBeenCalled();
});
