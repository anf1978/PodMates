// The CI deploy gate: which commit Deploy Pages builds, and whether it may publish it.
import { describe, expect, it } from "vitest";
import {
  githubApi,
  latestVerdict,
  planFromEvent,
  resolveDeployCommit,
} from "../scripts/resolve-deploy-commit.mjs";

/** main = c5 (head) → c4 → c3 → c2 → c1; `green` lists commits whose CI passed. */
function fakeApi(green: string[], main = ["c5", "c4", "c3", "c2", "c1"]) {
  return {
    mainHead: async () => main[0],
    parentOf: async (sha: string) => main[main.indexOf(sha) + 1],
    ciPassed: async (sha: string) => green.includes(sha),
    resolveRef: async (ref: string) => (ref === "v-old" ? "c2" : ref),
    onMain: async (sha: string) => main.includes(sha),
  };
}

const ciRun = (sha: string, conclusion = "success") =>
  planFromEvent({
    EVENT: "workflow_run",
    RUN_WORKFLOW: "CI",
    RUN_CONCLUSION: conclusion,
    RUN_HEAD_BRANCH: "main",
    RUN_HEAD_SHA: sha,
  });
const dataRun = () =>
  planFromEvent({
    EVENT: "workflow_run",
    RUN_WORKFLOW: "Rebuild Card Database",
    RUN_CONCLUSION: "success",
    RUN_HEAD_BRANCH: "main",
  });
const manual = (inputs: { ref?: string; deploy?: boolean; branch?: string }) =>
  planFromEvent({
    EVENT: "workflow_dispatch",
    GITHUB_REF: `refs/heads/${inputs.branch ?? "main"}`,
    GITHUB_SHA: "branch-sha",
    INPUT_REF: inputs.ref ?? "",
    INPUT_DEPLOY: String(inputs.deploy ?? false),
  });

describe("deploy gate", () => {
  it("deploys main's head when its CI passes", async () => {
    const result = await resolveDeployCommit(ciRun("c5"), fakeApi(["c5", "c4"]));
    expect(result).toMatchObject({ sha: "c5", deploy: true });
  });

  it("never deploys after a failed CI run", async () => {
    const result = await resolveDeployCommit(ciRun("c5", "failure"), fakeApi([]));
    expect(result.deploy).toBe(false);
    expect(result.sha).toBeUndefined();
  });

  it("skips an older CI run that finishes after a newer commit went green", async () => {
    const result = await resolveDeployCommit(ciRun("c4"), fakeApi(["c5", "c4"]));
    expect(result.deploy).toBe(false);
    expect(result.sha).toBeUndefined(); // nothing to build either
  });

  it("deploys an older green commit when it is still the newest green one", async () => {
    // c5 is red (or still running): c4 is the best build available, newer than what is live.
    const result = await resolveDeployCommit(ciRun("c4"), fakeApi(["c4", "c2"]));
    expect(result).toMatchObject({ sha: "c4", deploy: true });
  });

  it("ignores CI runs reported for branches other than main", async () => {
    const plan = planFromEvent({
      EVENT: "workflow_run",
      RUN_WORKFLOW: "CI",
      RUN_CONCLUSION: "success",
      RUN_HEAD_BRANCH: "feature",
    });
    expect((await resolveDeployCommit(plan, fakeApi(["c5"]))).deploy).toBe(false);
  });

  it("deploys fresh data on the newest green commit while main's head is red", async () => {
    const result = await resolveDeployCommit(dataRun(), fakeApi(["c3", "c1"]));
    expect(result).toMatchObject({ sha: "c3", deploy: true });
  });

  it("refuses to deploy when no recent commit passed CI", async () => {
    await expect(resolveDeployCommit(dataRun(), fakeApi([]))).rejects.toThrow(
      /No commit with passing CI/,
    );
  });

  it("rolls back to an older green commit on request, over a newer one", async () => {
    const result = await resolveDeployCommit(
      manual({ ref: "v-old", deploy: true }),
      fakeApi(["c5", "c2"]),
    );
    expect(result).toMatchObject({ sha: "c2", deploy: true });
  });

  it("refuses a rollback ref whose CI never passed or that is not on main", async () => {
    await expect(
      resolveDeployCommit(manual({ ref: "c3", deploy: true }), fakeApi(["c5"])),
    ).rejects.toThrow(/no passing CI/);
    await expect(
      resolveDeployCommit(manual({ ref: "zz", deploy: true }), fakeApi(["zz"])),
    ).rejects.toThrow(/not on main/);
  });

  it("builds any ref without publishing when deploy is unticked", async () => {
    const result = await resolveDeployCommit(manual({ ref: "c3" }), fakeApi([]));
    expect(result).toMatchObject({ sha: "c3", deploy: false });
    const branch = await resolveDeployCommit(manual({}), fakeApi([]));
    expect(branch).toMatchObject({ sha: "branch-sha", deploy: false });
  });

  it("redeploys the newest green commit from a manual run without a ref", async () => {
    const result = await resolveDeployCommit(manual({ deploy: true }), fakeApi(["c4"]));
    expect(result).toMatchObject({ sha: "c4", deploy: true });
  });

  it("never publishes from a manual run on another branch", async () => {
    const result = await resolveDeployCommit(manual({ deploy: true, branch: "test" }), fakeApi([]));
    expect(result.deploy).toBe(false);
  });
});

describe("CI verdict for a commit", () => {
  const run = (
    event: string,
    conclusion: string | null,
    created_at: string,
    status = "completed",
  ) => ({
    event,
    status,
    conclusion,
    created_at,
  });

  it("uses the newest completed push or dispatch run", () => {
    expect(
      latestVerdict([
        run("push", "failure", "2026-01-01"),
        run("workflow_dispatch", "success", "2026-01-02"),
      ]),
    ).toBe(true);
    expect(
      latestVerdict([
        run("push", "success", "2026-01-01"),
        run("workflow_dispatch", "failure", "2026-01-02"),
      ]),
    ).toBe(false);
  });

  it("ignores pull request and unfinished runs", () => {
    expect(latestVerdict([run("pull_request", "success", "2026-01-02")])).toBe(false);
    expect(latestVerdict([run("push", null, "2026-01-02", "in_progress")])).toBe(false);
  });

  it("queries only main's CI runs for the commit", async () => {
    const urls: string[] = [];
    const api = githubApi("o/r", "t", async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response(
        JSON.stringify({ workflow_runs: [run("push", "success", "2026-01-01")] }),
      );
    });
    expect(await api.ciPassed("abc")).toBe(true);
    expect(urls[0]).toBe(
      "https://api.github.com/repos/o/r/actions/workflows/ci.yml/runs?head_sha=abc&branch=main&per_page=30",
    );
  });
});
