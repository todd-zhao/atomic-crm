@echo off
rem ============================================================
rem  Atomic CRM - one-click stop (Windows)
rem  Stops the Vite dev server and the local Supabase containers.
rem  Database data stays in Docker volumes (use -RemoveVolumes to wipe).
rem ============================================================
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul 2>nul
title Atomic CRM - Stop

set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"

%PS% -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-atomic-crm.ps1" %*
if errorlevel 1 (
  echo.
  echo [ERROR] Stop script failed. Check the message above, or the log in .debug\logs\
  echo Press any key to close this window...
  pause >nul
)
endlocal
