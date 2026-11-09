@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo 需要管理员权限，正在请求提升...
    powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-supabase-port.ps1"
if not "%errorlevel%"=="0" (
    echo.
    echo 修复未完成，请查看上方输出。
)
echo.
pause
