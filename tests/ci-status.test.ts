// scripts/ci-status.mjs: what a session should do next, from the latest runs.
import { describe, expect, it } from "vitest";
import { nextStep } from "../scripts/ci-status.mjs";

const run = (created_at: string, conclusion: string | null = "success", status = "completed") => ({
  id: 1,
  status,
  conclusion,
  head_sha: "abc1234",
  html_url: "https://example.test/run",
  created_at,
  updated_at: created_at,
});

describe("nextStep", () => {
  it("waits while branch CI runs, and asks for a fix when it fails", () => {
    expect(
      nextStep({ branch: "claude/x", branchExists: true, branchCi: run("t1", null, "in_progress") })
        .code,
    ).toBe(2);
    const failed = nextStep({
      branch: "claude/x",
      branchExists: true,
      branchCi: run("t1", "failure"),
    });
    expect(failed).toMatchObject({ code: 1 });
    expect(failed.next).toContain("push to the same branch");
  });

  it("ignores an Auto-merge run from before this CI run", () => {
    const state = {
      branch: "claude/x",
      branchExists: true,
      branchCi: run("t2"),
      merge: run("t1", "failure"),
    };
    expect(nextStep(state)).toMatchObject({ code: 2 });
  });

  it("reports a merge conflict", () => {
    const state = {
      branch: "claude/x",
      branchExists: true,
      branchCi: run("t1"),
      merge: run("t2", "failure"),
    };
    expect(nextStep(state).next).toContain("git pull --rebase origin main");
  });

  it("follows a merged branch to the deploy", () => {
    const merged = {
      branch: "claude/x",
      branchExists: false,
      branchCi: run("t1"),
      merge: run("t2"),
    };
    expect(nextStep({ ...merged, deploy: run("t1") }).code).toBe(2); // the deploy is older than the merge
    expect(nextStep({ ...merged, deploy: run("t3", null, "in_progress") }).code).toBe(2);
    expect(nextStep({ ...merged, deploy: run("t3") }).code).toBe(0);
  });

  it("reports red CI on main after the merge", () => {
    const state = {
      branch: "claude/x",
      branchExists: false,
      branchCi: run("t1"),
      merge: run("t2", "failure"),
    };
    expect(nextStep(state).next).toContain("CI failed on main");
  });

  it("notices a branch that was never pushed", () => {
    expect(nextStep({ branch: "claude/x", branchExists: false }).code).toBe(1);
  });
});
