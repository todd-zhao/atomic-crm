@echo off
rem ============================================================
rem  Atomic CRM - one-click start (Windows)
rem  Starts Docker Desktop if needed, then local Supabase,
rem  then the Vite dev server, and opens the browser.
rem ============================================================
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul 2>nul
title Atomic CRM - Start

set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"

%PS% -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-atomic-crm.ps1" %*
if errorlevel 1 (
  echo.
  echo [ERROR] Startup failed. Check the message above, or the log in .debug\logs\
  echo Press any key to close this window...
  pause >nul
)
endlocal
