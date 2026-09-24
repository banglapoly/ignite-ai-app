@echo off
REM Stops whatever process is listening on port 8000 (the Flame in Freefall server).
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force; Write-Host ('Stopped PID ' + $_.OwningProcess) }"
