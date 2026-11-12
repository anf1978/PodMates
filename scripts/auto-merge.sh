#!/usr/bin/env bash
# Merges a session branch (ccr-<id> or claude/<topic>) whose CI passed into main, keeping its commits (rebased onto main when main
# has moved). Run by .github/workflows/auto-merge.yml from a checkout of main with full history.
# Env: BRANCH (ccr-... or claude/...), TESTED_SHA (the commit CI passed on; empty for a manual run), GH_TOKEN.
# Outputs: merged=true|false, sha=<new main head>.
set -euo pipefail

say() { echo "$*" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
output() { echo "$1" >> "${GITHUB_OUTPUT:-/dev/null}"; }
output merged=false

if [[ ! "$BRANCH" =~ ^(claude/[A-Za-z0-9._/-]+|ccr-[A-Za-z0-9._-]+)$ ]]; then
  say "::error title=Auto-merge::Only ccr- and claude/ branches are merged automatically, not '$BRANCH'."
  exit 1
fi

git fetch --quiet origin main "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
tip=$(git rev-parse "origin/$BRANCH")
if [ -n "${TESTED_SHA:-}" ] && [ "$tip" != "$TESTED_SHA" ]; then
  say "Skipped: $BRANCH moved on to ${tip:0:7} after CI passed on ${TESTED_SHA:0:7}; the newer commit's CI decides."
  exit 0
fi

if git log -1 --format=%B "$tip" | grep -qi '\[wip\]'; then
  say "Not merged: the latest commit on $BRANCH is marked [wip]. Push a commit without [wip] to ship it."
  exit 0
fi

green=$(gh run list --workflow ci.yml --branch "$BRANCH" --commit "$tip" --status success --limit 1 --json databaseId -q length)
if [ "$green" != 1 ]; then
  say "::error title=Auto-merge::${tip:0:7} on $BRANCH has no passing CI run; not merged."
  exit 1
fi

# GITHUB_TOKEN may not push changes to workflow files, so those need a human merge.
if git diff --name-only "origin/main...$tip" | grep -q '^\.github/workflows/'; then
  say "### Needs a human merge"
  say "$BRANCH changes .github/workflows/, which the Actions token cannot push. Tap **Merge** on its PR in GitHub Mobile."
  if ! gh pr view "$BRANCH" --json url -q .url 2> /dev/null; then
    gh pr create --base main --head "$BRANCH" --title "$(git log -1 --format=%s "$tip")" \
      --body "CI passed on ${tip:0:7}. Auto-merge cannot push workflow-file changes; merge this PR to ship it." ||
      say "Could not open the PR (Settings → Actions → allow GitHub Actions to create pull requests); open it from GitHub Mobile."
  fi
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
for attempt in 1 2 3; do
  git checkout --quiet --detach "$tip"
  # A no-op when main has not moved: main then gets exactly the commits CI tested.
  if ! git rebase --quiet origin/main; then
    git rebase --abort
    say "::error title=Auto-merge::$BRANCH conflicts with main. Rebase it (git pull --rebase origin main) and push again."
    exit 1
  fi
  count=$(git rev-list --count origin/main..HEAD)
  if [ "$count" = 0 ]; then
    say "$BRANCH is already on main; nothing to merge."
    git push --quiet origin --delete --force-with-lease="refs/heads/$BRANCH:$tip" "$BRANCH" || true
    exit 0
  fi
  if git push --quiet origin HEAD:main; then break; fi
  [ "$attempt" = 3 ] && { say "::error title=Auto-merge::main kept moving; push $BRANCH again to retry."; exit 1; }
  git fetch --quiet origin main
done

sha=$(git rev-parse HEAD)
output merged=true
output "sha=$sha"
how=$([ "$sha" = "$tip" ] && echo "exactly as tested" || echo "rebased onto a newer main")
say "Merged $BRANCH into main at ${sha:0:7}: $count commit(s), $how."
git push --quiet origin --delete --force-with-lease="refs/heads/$BRANCH:$tip" "$BRANCH" ||
  say "Kept $BRANCH: it changed after the merge."
