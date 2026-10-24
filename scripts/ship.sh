#!/usr/bin/env bash
# Publish content in one command: check it, open a PR, wait for the required `verify` check, squash-merge.
# The merge deploys through Workers Builds. Upload media first with `pnpm media:upload`.
# Usage: pnpm ship "<commit message>" [paths...]   (paths default to content/articles)
set -euo pipefail

msg=${1:?usage: pnpm ship "<commit message>" [paths...]}
shift
paths=("${@:-content/articles}")

[ "$(git branch --show-current)" = main ] || { echo "ship: switch to main first" >&2; exit 1; }
# Anything dirty outside the shipped paths would be checked locally but never shipped.
others=$(git status --porcelain -- . "${paths[@]/#/:!}")
[ -z "$others" ] || { printf 'ship: unrelated changes, commit or stash them first:\n%s\n' "$others" >&2; exit 1; }
[ -n "$(git status --porcelain -- "${paths[@]}")" ] || { echo "ship: nothing to publish" >&2; exit 1; }

git pull --ff-only -q
export PUBLIC_MEDIA_BASE_URL=${PUBLIC_MEDIA_BASE_URL:-https://media.jelementi.quz.ma/}
# Fast local checks for the usual mistakes; CI runs the full verify:deploy on the PR.
pnpm content:validate
pnpm media:verify

branch="ship/$(date +%Y%m%d-%H%M%S)"
git switch -qc "$branch"
git add -- "${paths[@]}"
git commit -qm "$msg"
git push -qu origin "$branch"
gh pr create --base main --head "$branch" --title "$msg" --body "Shipped with \`pnpm ship\`."
head=$(git rev-parse HEAD)
sleep 10 # let GitHub register the check before watching it
gh pr checks "$branch" --watch --fail-fast --interval 15 || { echo "ship: checks failed, PR left open" >&2; exit 1; }
gh pr merge "$branch" --squash --delete-branch --match-head-commit "$head"
git switch -q main
git pull --ff-only -q
echo "ship: merged as $(git rev-parse --short HEAD); Workers Builds deploys it in about 5 minutes."
