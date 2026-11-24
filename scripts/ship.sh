#!/usr/bin/env bash
# Usage: scripts/ship.sh "<commit and PR title>"
set -euo pipefail
message="${1:?supply the commit and PR title}"
branch="$(git branch --show-current)"
if [[ -z "$branch" || "$branch" == main ]]; then
  echo "Ship a feature branch." >&2
  exit 1
fi

npm run lint && npm run typecheck && npm test && npm run build || exit 1
git add -A
git diff --cached --quiet || git commit -m "$message"
head_sha="$(git rev-parse HEAD)"
git push -u origin "$branch"
number="$(gh pr view "$branch" --json number --jq .number 2>/dev/null || true)"
if [[ -z "$number" ]]; then
  gh pr create --base main --head "$branch" --fill
  number="$(gh pr view "$branch" --json number --jq .number)"
fi

# Private repositories on GitHub Free can merge immediately with --auto.
# Wait for the named check on this exact commit before requesting any merge.
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
for ((attempt=0; attempt<120; attempt++)); do
  check="$(gh api "repos/$repo/commits/$head_sha/check-runs" --jq '[.check_runs[] | select(.name=="ci" and .app.slug=="github-actions")] | sort_by(.id) | last | if . == null then "pending" else (.conclusion // .status) end')"
  case "$check" in
    success)
      git fetch -q origin main
      git merge-base --is-ancestor origin/main "$head_sha" || { echo "Rebase on origin/main and run ship again." >&2; exit 1; }
      gh pr merge "$number" --squash --match-head-commit "$head_sha"
      exit 0 ;;
    pending|queued|in_progress|waiting|requested) sleep 5 ;;
    *) echo "ci finished with $check" >&2; exit 1 ;;
  esac
done
echo "No successful ci check for $head_sha yet." >&2
exit 1
