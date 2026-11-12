#!/usr/bin/env bash
# Starts a workflow with workflow_dispatch and waits for that run to finish; exits non-zero if it fails.
# Runs started by the Actions token's pushes never trigger other workflows, so the delivery workflows
# chain through this instead. Usage: dispatch-and-watch.sh <workflow file> <ref> <commit sha>. Env: GH_TOKEN.
set -euo pipefail
workflow=$1 ref=$2 sha=$3
gh workflow run "$workflow" --ref "$ref"
id=""
for _ in $(seq 1 30); do
  sleep 10
  id=$(gh run list --workflow "$workflow" --branch "$ref" --event workflow_dispatch --commit "$sha" --limit 1 \
    --json databaseId -q '.[0].databaseId // empty')
  [ -n "$id" ] && break
done
if [ -z "$id" ]; then
  echo "::error title=$workflow::The dispatched run for ${sha:0:7} did not appear."
  exit 1
fi
url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$id"
echo "Waiting for $workflow on $ref (${sha:0:7}): $url" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
if gh run watch "$id" --exit-status --interval 30 > /dev/null; then
  echo "$workflow passed on ${sha:0:7}." | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
else
  echo "::error title=$workflow::$workflow failed on ${sha:0:7}: $url" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 1
fi
