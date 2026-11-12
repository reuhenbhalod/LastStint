#!/usr/bin/env bash
# Sets up GitHub Actions runners for LastStint inside WSL2 (Ubuntu) on the PC, so CI and deploys
# run there for free instead of on GitHub-hosted runners (docs/pc-ci-runner.md).
#
# Run inside WSL (Ubuntu), as your normal user (not root):
#   bash setup-wsl-runner.sh <REGISTRATION_TOKEN> [RUNNER_COUNT]
#
# REGISTRATION_TOKEN: GitHub → repo Settings → Actions → Runners → New self-hosted runner → Linux;
#   copy the value after --token. It expires after an hour, and one token registers every runner.
# RUNNER_COUNT: how many runners (jobs at once); default 3. CI's PR run has 5 jobs.
set -euo pipefail

TOKEN="${1:?usage: setup-wsl-runner.sh <REGISTRATION_TOKEN> [RUNNER_COUNT]}"
COUNT="${2:-3}"
REPO_URL="https://github.com/reuhenbhalod/LastStint"
PLAYWRIGHT_VERSION="1.49.1"   # apps/web/package.json @playwright/test
LABELS="wsl"

if [ "$(id -u)" = 0 ]; then echo "Run as your normal user, not root." >&2; exit 1; fi
if ! grep -qi microsoft /proc/version; then echo "This doesn't look like WSL; continuing anyway." >&2; fi

# 1. systemd, so the runners start as services whenever WSL starts.
if ! grep -qs '^systemd=true' /etc/wsl.conf; then
  printf '[boot]\nsystemd=true\n' | sudo tee -a /etc/wsl.conf >/dev/null
  echo
  echo "systemd was just enabled. In Windows PowerShell run:  wsl --shutdown"
  echo "then open Ubuntu again and re-run this script with the same arguments."
  exit 0
fi

# 2. Packages the CI jobs expect on ubuntu-latest (Node, pnpm, uv and Python come from the
#    workflow's setup actions; these are the system pieces).
sudo apt-get update
sudo apt-get install -y curl git jq tar unzip build-essential python3 python3-venv ca-certificates nodejs npm

# 3. Chromium's system libraries for the Playwright e2e job, installed once here because the
#    runner can't answer a sudo prompt (the workflow installs only the browser).
sudo npx -y "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium

# 4. Download the latest runner and register COUNT copies, each as a systemd service.
version=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name | sed 's/^v//')
tarball="$HOME/actions-runner-linux-x64-${version}.tar.gz"
[ -f "$tarball" ] || curl -fsSL -o "$tarball" \
  "https://github.com/actions/runner/releases/download/v${version}/actions-runner-linux-x64-${version}.tar.gz"

for i in $(seq 1 "$COUNT"); do
  dir="$HOME/actions-runner-$i"
  if [ -f "$dir/.runner" ]; then echo "Runner $i already configured in $dir, skipping."; continue; fi
  mkdir -p "$dir"
  tar xzf "$tarball" -C "$dir"
  (
    cd "$dir"
    ./config.sh --unattended --replace --url "$REPO_URL" --token "$TOKEN" \
      --name "pc-wsl-$i" --labels "$LABELS" --work _work
    sudo ./svc.sh install "$USER"
    sudo ./svc.sh start
  )
done

echo
echo "Done: $COUNT runners registered (pc-wsl-1..$COUNT, label '$LABELS')."
echo "Check GitHub → Settings → Actions → Runners: they should show Idle."
echo "Last step is in Windows (keep WSL running): see docs/pc-ci-runner.md, step 3."
