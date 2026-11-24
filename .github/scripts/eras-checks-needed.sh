#!/usr/bin/env bash
# Prints "true" when the long Eras checks (reachability, Eras browser specs) must run, "false"
# when they can be skipped. Reasons are written to stderr for the job log.
#
# Skipped when:
#  - a push to main merges exactly the code its pull request already tested (same tree as the
#    PR head) and that PR's CI run passed, or
#  - nothing that can affect an Eras race changed: race data, the sim or schema, the Eras
#    worker/web code or the Eras specs (unit-test files don't count, nor does a pools change
#    that only moves races between Daily and Gauntlet).
# Always run on workflow_dispatch or when the comparison base is unknown.
#
# Env: EVENT, BASE (PR base sha or the push's "before" sha), GITHUB_SHA, GITHUB_REPOSITORY, GH_TOKEN.
set -uo pipefail

if [ "$EVENT" = workflow_dispatch ] || [ -z "${BASE:-}" ] \
   || ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  echo "Manual run or unknown base: running the Eras checks." >&2; echo true; exit 0
fi

if [ "$EVENT" = push ]; then
  pr_head=$(gh api "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/pulls" -q '.[0].head.sha' 2>/dev/null || true)
  if [ -n "$pr_head" ] && git cat-file -e "$pr_head^{commit}" 2>/dev/null \
     && [ "$(git rev-parse "$GITHUB_SHA^{tree}")" = "$(git rev-parse "$pr_head^{tree}")" ]; then
    passed=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow ci.yml --commit "$pr_head" \
      --event pull_request --status success --json databaseId -q 'length' 2>/dev/null || echo 0)
    if [ "${passed:-0}" -gt 0 ]; then
      echo "Same code as PR head $pr_head, whose CI passed: Eras checks skipped." >&2; echo false; exit 0
    fi
  fi
fi

files=$(git diff --name-only "$BASE"...HEAD)
echo "$files" >&2

# A pools change that only moves races between Daily and Gauntlet can't affect an Eras race:
# the eras lists and the set of Daily + Gauntlet races (the shared races, served with their
# overlays) are the same. Then data/pools.json and the Daily/Gauntlet grade fixture don't count.
if echo "$files" | grep -qx 'data/pools.json'; then
  base=$(git merge-base "$BASE" HEAD)
  if git show "$base:data/pools.json" | python3 -c '
import json, sys
old = json.load(sys.stdin)
new = json.load(open("data/pools.json"))
shared = lambda p: set(p["daily"]) | set(p["survivor"])
sys.exit(0 if old["eras"] == new["eras"] and shared(old) == shared(new) else 1)
'; then
    echo "data/pools.json: only Daily/Gauntlet membership changed." >&2
    files=$(echo "$files" | grep -vxE 'data/pools\.json|packages/sim/tests/fixtures/pool-grades\.json')
  fi
fi
if echo "$files" | grep -vE '\.test\.tsx?$' \
   | grep -qE '^(data/|packages/sim/|packages/schema/|apps/worker/src/eras|apps/worker/scripts/reachability|apps/web/src/eras/|apps/web/e2e/eras)'; then
  echo "Eras-related change: running the Eras checks." >&2; echo true
else
  echo "No Eras-related change: Eras checks skipped." >&2; echo false
fi
