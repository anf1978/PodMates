// Decides which commit Deploy Pages builds and whether it may publish it (the CI deploy gate).
//
// - CI finished on main: publish only if that commit is the newest commit on main whose CI passed,
//   so an older run finishing late never deploys over a newer good build.
// - A weekly data rebuild finished: publish the newest commit on main whose CI passed, even when
//   main's head is red, so fresh data still goes live.
// - Manual run: with `ref`, build that commit; publishing it (a rollback) requires it to be on main
//   and to have a passing CI run. Without `ref` and with deploy ticked, redeploy the newest green
//   commit. Without either, build the selected branch only.
//
// The pure parts (`planFromEvent`, `resolveDeployCommit`) are unit-tested with a fake API; the CLI at
// the bottom talks to the GitHub REST API with the workflow's read-only token.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CI_WORKFLOW_FILE = "ci.yml";
export const CI_WORKFLOW_NAME = "CI";
const MAX_WALK = 40;
const GATING_EVENTS = new Set(["push", "workflow_dispatch"]);

/**
 * Turn the Actions event into a plan.
 * @param {Record<string, string | undefined>} env
 */
export function planFromEvent(env) {
  const event = env.EVENT ?? "";
  if (event === "workflow_run") {
    if (env.RUN_CONCLUSION !== "success") {
      return {
        skip: `${env.RUN_WORKFLOW} finished with "${env.RUN_CONCLUSION}"; nothing to deploy.`,
      };
    }
    if (env.RUN_HEAD_BRANCH !== "main") {
      return { skip: `${env.RUN_WORKFLOW} ran on "${env.RUN_HEAD_BRANCH}", not main.` };
    }
    if (env.RUN_WORKFLOW === CI_WORKFLOW_NAME) {
      return {
        mode: "auto",
        expectSha: env.RUN_HEAD_SHA,
        deploy: true,
        trigger: "CI passed on main",
      };
    }
    return { mode: "auto", deploy: true, trigger: `${env.RUN_WORKFLOW} refreshed the data` };
  }
  if (event === "workflow_dispatch") {
    const onMain = env.GITHUB_REF === "refs/heads/main";
    const deploy = onMain && env.INPUT_DEPLOY === "true";
    const ref = (env.INPUT_REF ?? "").trim();
    if (ref)
      return { mode: "ref", ref, requireGreen: deploy, deploy, trigger: `manual run for ${ref}` };
    if (deploy)
      return { mode: "auto", deploy, trigger: "manual redeploy of the newest green commit" };
    return {
      mode: "ref",
      ref: env.GITHUB_SHA ?? "",
      requireGreen: false,
      deploy: false,
      trigger: "manual build-only run",
    };
  }
  return { skip: `Unsupported event "${event}".` };
}

/**
 * @typedef {{
 *   mainHead(): Promise<string>,
 *   parentOf(sha: string): Promise<string | undefined>,
 *   ciPassed(sha: string): Promise<boolean>,
 *   resolveRef(ref: string): Promise<string>,
 *   onMain(sha: string, mainSha: string): Promise<boolean>,
 * }} GateApi
 */

/**
 * @param {ReturnType<typeof planFromEvent>} plan
 * @param {GateApi} api
 * @returns {Promise<{ sha?: string, deploy: boolean, notes: string[] }>}
 */
export async function resolveDeployCommit(plan, api) {
  if ("skip" in plan) return { deploy: false, notes: [plan.skip ?? ""] };
  const notes = [`Trigger: ${plan.trigger}.`];
  if (plan.mode === "auto") {
    const head = await api.mainHead();
    let sha = head;
    for (let steps = 0; sha && steps < MAX_WALK; steps++) {
      if (await api.ciPassed(sha)) {
        notes.push(
          sha === head
            ? `main's head ${short(sha)} passed CI.`
            : `Newest commit on main with passing CI: ${short(sha)} (main's head ${short(head)} has not passed CI).`,
        );
        if (plan.expectSha && plan.expectSha !== sha) {
          notes.push(
            `This CI run was for ${short(plan.expectSha)}, which is not the newest green commit; skipping.`,
          );
          return { deploy: false, notes };
        }
        return { sha, deploy: Boolean(plan.deploy), notes };
      }
      sha = (await api.parentOf(sha)) ?? "";
    }
    throw new Error(
      `No commit with passing CI in the last ${MAX_WALK} commits on main; nothing deployed.`,
    );
  }
  const sha = await api.resolveRef(plan.ref ?? "");
  notes.push(`Ref ${plan.ref} is ${short(sha)}.`);
  if (plan.requireGreen) {
    if (!(await api.onMain(sha, await api.mainHead()))) {
      throw new Error(`${short(sha)} is not on main; only commits on main can be deployed.`);
    }
    if (!(await api.ciPassed(sha))) {
      throw new Error(`${short(sha)} has no passing CI run on main; refusing to deploy it.`);
    }
    notes.push(`${short(sha)} is on main and passed CI.`);
  }
  return { sha, deploy: Boolean(plan.deploy), notes };
}

/** @param {string} sha */
const short = (sha) => sha.slice(0, 7);

/**
 * The GitHub REST adapter.
 * @param {string} repo owner/name
 * @param {string} token
 * @returns {GateApi}
 */
export function githubApi(repo, token, fetchImpl = fetch) {
  /** @param {string} path */
  const get = async (path) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) throw new Error(`GitHub API ${path}: HTTP ${response.status}`);
    return response.json();
  };
  return {
    mainHead: async () => (await get("commits/main")).sha,
    parentOf: async (sha) => (await get(`commits/${sha}`)).parents?.[0]?.sha,
    resolveRef: async (ref) => (await get(`commits/${encodeURIComponent(ref)}`)).sha,
    onMain: async (sha, mainSha) =>
      ["identical", "ahead"].includes((await get(`compare/${sha}...${mainSha}`)).status),
    ciPassed: async (sha) => {
      const { workflow_runs: runs = [] } = await get(
        `actions/workflows/${CI_WORKFLOW_FILE}/runs?head_sha=${sha}&branch=main&per_page=30`,
      );
      return latestVerdict(runs);
    },
  };
}

/**
 * The newest completed main CI run (push or dispatch) for a commit decides whether it is green.
 * @param {Array<{ event: string, status: string, conclusion: string | null, created_at: string }>} runs
 */
export function latestVerdict(runs) {
  const completed = runs
    .filter((run) => GATING_EVENTS.has(run.event) && run.status === "completed")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return completed[0]?.conclusion === "success";
}

async function main() {
  const {
    GITHUB_REPOSITORY = "",
    GITHUB_TOKEN = "",
    GITHUB_OUTPUT,
    GITHUB_STEP_SUMMARY,
  } = process.env;
  const plan = planFromEvent(process.env);
  const result = await resolveDeployCommit(plan, githubApi(GITHUB_REPOSITORY, GITHUB_TOKEN)).catch(
    (/** @type {Error} */ error) => ({ error }),
  );
  const lines =
    "error" in result
      ? [`### Deploy gate: refused`, "", `**${result.error.message}**`]
      : [
          `### Deploy gate: ${result.deploy ? `deploying ${short(result.sha ?? "")}` : result.sha ? `build only (${short(result.sha)})` : "skipped"}`,
          "",
          ...result.notes.map((note) => `- ${note}`),
        ];
  console.log(lines.join("\n"));
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  if ("error" in result) {
    console.log(`::error title=Deploy gate::${result.error.message}`);
    process.exit(1);
  }
  if (GITHUB_OUTPUT) {
    appendFileSync(
      GITHUB_OUTPUT,
      `sha=${result.sha ?? ""}\nbuild=${Boolean(result.sha)}\ndeploy=${result.deploy}\n`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
