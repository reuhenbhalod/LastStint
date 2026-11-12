# CI on the PC (self-hosted runner)

GitHub-hosted Actions minutes cost money on a private repo once the free allowance is used, and
the GitHub bill stays at $0. So CI, staging and production deploys run on the PC instead, inside
WSL2 (Ubuntu), at no cost. Development stays on the Mac:

```
Mac: git push  →  GitHub  →  PC runner (WSL): checks, then deploy if it's main and all passed
```

The PC never needs a copy of your work: each job checks out the commit from GitHub, runs in a
scratch folder under `~/actions-runner-N/_work`, and reports back to GitHub (PR checks, Actions
tab, `gh` on the Mac). The deploy jobs use the Cloudflare secrets stored in GitHub, so the PC
needs no Cloudflare login.

**The PC must be on, signed in and online.** If it isn't, jobs wait in the queue (up to 24 hours)
and run when it's back.

## Setup (once, about 15 minutes)

1. **WSL2 with Ubuntu.** If it isn't installed: in PowerShell as administrator, `wsl --install -d Ubuntu`,
   restart, open Ubuntu and create your user.
2. **Runners.** In GitHub: repo Settings → Actions → Runners → New self-hosted runner → Linux.
   Copy the token (the value after `--token`; it expires in an hour). In Ubuntu, get the
   scripts (they're on the `eras` branch until it merges to main) and run:
   ```sh
   git clone -b eras https://github.com/reuhenbhalod/LastStint.git ~/LastStint && cd ~/LastStint
   bash .github/runner/setup-wsl-runner.sh <TOKEN> 3
   ```
   The first time it enables systemd and asks you to run `wsl --shutdown` in PowerShell, reopen
   Ubuntu and run it again. It installs the system packages, Chromium's libraries for the e2e
   job, and three runners (`pc-wsl-1..3`) as services.
3. **Keep WSL running.** In Windows PowerShell (not Ubuntu):
   ```powershell
   powershell -ExecutionPolicy Bypass -File \\wsl$\Ubuntu\home\<you>\LastStint\.github\runner\keep-wsl-running.ps1
   ```
   It registers a sign-in task that keeps WSL alive and turns off sleep on AC power.
4. **Check.** GitHub → Settings → Actions → Runners shows `pc-wsl-1..3` as Idle. Every workflow
   already targets them (`runs-on: [self-hosted, linux, wsl]`), so any queued job starts now.

## Notes

- Three runners run three jobs at a time. A PR run has five jobs; parity and e2e take ~20 min
  each, Eras reachability ~100 min when it runs. More runners (`setup-wsl-runner.sh <TOKEN> 5`)
  help if the PC has the cores and memory.
- The runners are Linux, like `ubuntu-latest`, so the parity exemptions for the four races whose
  Linux build drifts from the Mac's (`ci.yml`) still apply.
- To remove a runner: `cd ~/actions-runner-N && sudo ./svc.sh uninstall && ./config.sh remove --token <TOKEN>`.
- Logs: `journalctl -u 'actions.runner.*' -f` in Ubuntu.
