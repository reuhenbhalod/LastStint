# Keeps WSL (and the CI runners inside it) running on the PC (docs/pc-ci-runner.md, step 3).
# WSL stops a distro a few seconds after its last process ends, which would take the runners
# down with it; this starts a process that never ends, at every Windows sign-in.
#
# Run once in Windows PowerShell (not WSL), as your normal user:
#   powershell -ExecutionPolicy Bypass -File keep-wsl-running.ps1 [-Distro Ubuntu]
param([string]$Distro = "Ubuntu")

$action  = New-ScheduledTaskAction -Execute "wsl.exe" -Argument "-d $Distro --exec /bin/sleep infinity"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "LastStint WSL keep-alive" -Action $action -Trigger $trigger `
  -Settings $settings -Description "Keeps WSL running for the LastStint CI runners" -Force | Out-Null
Start-ScheduledTask -TaskName "LastStint WSL keep-alive"

# Don't let the PC sleep while plugged in (jobs queue until it wakes otherwise).
powercfg /change standby-timeout-ac 0

Write-Host "WSL keep-alive task registered and started; sleep on AC power is off."
