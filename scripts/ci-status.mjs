// Where is my change? Follows a claude/ branch through CI → Auto-merge → CI on main → Deploy Pages using
// the public GitHub API, so a session needs no `gh` login. Prints failing tests and errors (the CI
// annotations) and what to do next.
//
// Usage: node scripts/ci-status.mjs <branch>
// Without a token GitHub allows 60 requests an hour (each call uses about 6): wait 3–5 minutes between
// calls. GH_TOKEN or GITHUB_TOKEN, when set, is used and lifts the limit.
// Exit code: 0 deployed, 1 failed (read the output), 2 still in progress.
import { pathToFileURL } from "node:url";

const REPO = "anf1978/PodMates";

/**
 * @typedef {{ id: number, name?: string, status: string, conclusion: string | null, head_sha: string,
 *   html_url: string, created_at: string, updated_at: string }} Run
 * @typedef {{ branch: string, branchExists: boolean, branchCi?: Run, merge?: Run, mainCi?: Run,
 *   deploy?: Run }} State
 */

/**
 * The next step, given the latest runs. Pure, so it is unit-tested.
 * @param {State} s
 * @returns {{ code: 0 | 1 | 2, next: string }}
 */
export function nextStep(s) {
  const done = (/** @type {Run | undefined} */ run) => run?.status === "completed";
  const ok = (/** @type {Run | undefined} */ run) => done(run) && run?.conclusion === "success";
  const after = (/** @type {Run | undefined} */ a, /** @type {Run | undefined} */ b) =>
    Boolean(a && b && a.created_at >= b.created_at); // run a started after run b

  if (s.branchExists) {
    if (!s.branchCi)
      return { code: 2, next: "CI has not started for this branch yet; check again in a minute." };
    if (!done(s.branchCi))
      return { code: 2, next: "CI is running on the branch (about 5 minutes)." };
    if (!ok(s.branchCi)) {
      return {
        code: 1,
        next: "CI failed on the branch. Fix the errors above, commit and push to the same branch.",
      };
    }
    const merge = after(s.merge, s.branchCi) ? s.merge : undefined;
    if (!merge || !done(merge))
      return { code: 2, next: "CI passed; Auto-merge is merging the branch into main." };
    if (!ok(merge)) {
      return {
        code: 1,
        next: "Auto-merge failed (errors above). For a conflict: git pull --rebase origin main, then push the branch again.",
      };
    }
    return {
      code: 1,
      next: "Auto-merge finished but the branch is still there: it changes .github/workflows/ (a human taps Merge on its PR) or it moved after CI; read the Auto-merge summary.",
    };
  }
  if (!s.branchCi)
    return {
      code: 1,
      next: "No branch and no CI run: push the branch first (git push -u origin <branch>).",
    };
  if (s.merge && !done(s.merge))
    return { code: 2, next: "Auto-merge is running CI on main (about 5 minutes)." };
  if (s.merge && !ok(s.merge)) {
    return {
      code: 1,
      next: "Merged, but CI failed on main (errors above). Production stays on the last good build. Fix it on a new claude/ branch now, or revert.",
    };
  }
  if (!after(s.deploy, s.merge) || !done(s.deploy))
    return { code: 2, next: "Merged and green; Deploy Pages is publishing." };
  if (!ok(s.deploy))
    return {
      code: 1,
      next: "Deploy Pages failed; read its Summary (the deploy gate explains why).",
    };
  return {
    code: 0,
    next: "Done: merged, CI green on main and deployed to https://anf1978.github.io/PodMates/.",
  };
}

/** @param {Run | undefined} run @param {string} label */
export function line(label, run) {
  if (!run) return `${label}: no run yet`;
  const state =
    run.status === "completed"
      ? run.conclusion === "success"
        ? "✅ success"
        : `❌ ${run.conclusion}`
      : `⏳ ${run.status}`;
  return `${label}: ${state} on ${run.head_sha.slice(0, 7)} (${run.created_at}) ${run.html_url}`;
}

/** @param {string} path */
async function api(path, fetchImpl = fetch) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const response = await fetchImpl(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "podmates-ci-status",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(`GitHub API ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

/** @param {string} workflow @param {string} query */
const latest = async (workflow, query = "") =>
  /** @type {Run | undefined} */ (
    (await api(`actions/workflows/${workflow}/runs?per_page=1${query}`))?.workflow_runs?.[0]
  );

/** Failing jobs' error annotations (test names, first error lines) for a run. @param {Run} run */
async function errors(run) {
  const { jobs = [] } = (await api(`actions/runs/${run.id}/jobs`)) ?? {};
  const out = [];
  for (const job of jobs.filter(
    (/** @type {{ conclusion: string }} */ j) => j.conclusion === "failure",
  )) {
    const notes = (await api(`check-runs/${job.id}/annotations`)) ?? [];
    for (const note of notes.filter(
      (/** @type {{ annotation_level: string }} */ n) => n.annotation_level === "failure",
    )) {
      out.push(`  [${job.name}] ${note.title ? `${note.title}: ` : ""}${note.message}`);
    }
  }
  return out;
}

async function main() {
  const branch = process.argv[2] ?? "";
  if (!/^(claude|wip)\/[\w./-]+$/.test(branch)) {
    console.error("Usage: node scripts/ci-status.mjs <claude/… or wip/… branch>");
    process.exit(64);
  }
  const branchExists = Boolean(await api(`branches/${encodeURIComponent(branch)}`));
  const state = {
    branch,
    branchExists,
    branchCi: await latest("ci.yml", `&branch=${encodeURIComponent(branch)}`),
    merge: await latest("auto-merge.yml"),
    mainCi: branchExists ? undefined : await latest("ci.yml", "&branch=main"),
    deploy: branchExists ? undefined : await latest("deploy.yml"),
  };
  console.log(
    `Branch ${branch}: ${branchExists ? "exists" : "gone (merged and deleted, or never pushed)"}`,
  );
  console.log(line("CI on branch", state.branchCi));
  console.log(line("Auto-merge (latest, any branch)", state.merge));
  if (!branchExists)
    console.log(line("CI on main", state.mainCi), "\n" + line("Deploy Pages", state.deploy));
  for (const run of [state.branchCi, state.merge, state.mainCi, state.deploy]) {
    if (run?.status === "completed" && run.conclusion === "failure") {
      const found = await errors(run);
      if (found.length) console.log(`Errors in ${run.html_url}:\n${found.join("\n")}`);
    }
  }
  const { code, next } = nextStep(state);
  console.log(`\nNext: ${next}`);
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
