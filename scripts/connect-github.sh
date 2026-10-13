#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$#" -ne 1 ]; then
  echo "Usage: ./scripts/connect-github.sh https://github.com/YOU/breach-intel-website.git"
  exit 1
fi
git rev-parse --is-inside-work-tree >/dev/null
url="$1"
if git remote get-url origin >/dev/null 2>&1; then
  current="$(git remote get-url origin)"
  if [ "$current" != "$url" ]; then
    echo "Existing origin differs: $current"
    echo "Run git remote set-url origin <new-url> if you want to change it."
    exit 1
  fi
else
  git remote add origin "$url"
fi
git push -u origin main
printf '\nGitHub connected. You can now push from VS Code.\n'
