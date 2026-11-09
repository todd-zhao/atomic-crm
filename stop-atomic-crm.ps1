#requires -Version 5.1
<#
.SYNOPSIS
    Atomic CRM 一键停止：前端 Vite -> 本地 Supabase 容器。
.DESCRIPTION
    可在资源管理器中双击仓库根目录的 stop-atomic-crm.cmd 运行，也可以在本目录执行：
        powershell -NoProfile -ExecutionPolicy Bypass -File .\stop-atomic-crm.ps1
    默认保留 Supabase 数据（Docker volume）与 Docker Desktop 运行状态。
.PARAMETER QuitDocker
    停止 Supabase 之后同时退出 Docker Desktop。
.PARAMETER NoPause
    结束时不停留等待按键（供自动化/命令行调用）。
.PARAMETER RemoveVolumes
    同时删除本地 Supabase 的数据卷（会清空全部 CRM 数据与用户，慎用）。
#>
[CmdletBinding()]
param(
    [switch]$QuitDocker,
    [switch]$NoPause,
    [switch]$RemoveVolumes
)

$ErrorActionPreference = 'Continue'

$repo = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
if (Test-Path (Join-Path $repo 'package.json')) { Set-Location $repo }

$logDir = Join-Path $repo '.debug\logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$logFile = Join-Path $logDir ('stop-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$transcribing = $false
try { Start-Transcript -Path $logFile -Force | Out-Null; $transcribing = $true } catch { }

function Write-Step([string]$n, [string]$msg) {
    Write-Host ''
    Write-Host "[$n] $msg" -ForegroundColor Cyan
}
function Write-Ok([string]$msg) { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Info([string]$msg) { Write-Host "    $msg" -ForegroundColor Gray }
function Write-Warn([string]$msg) { Write-Host "    [!] $msg" -ForegroundColor Yellow }

function Test-Tcp {
    param([int]$Port, [string]$Target = '127.0.0.1')
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $ar = $client.BeginConnect($Target, $Port, $null, $null)
        if (-not $ar.AsyncWaitHandle.WaitOne(700, $false)) { return $false }
        $client.EndConnect($ar)
        return $true
    } catch { return $false } finally { try { $client.Close() } catch { } }
}

Write-Host ''
Write-Host '==============================================================' -ForegroundColor DarkCyan
Write-Host '                 Atomic CRM  本地一键停止' -ForegroundColor White
Write-Host '==============================================================' -ForegroundColor DarkCyan
Write-Host "    项目目录: $repo"
Write-Host "    运行日志: $logFile"

# ---------- 1. 停止前端 ----------
Write-Step '1/4' '停止前端（Vite / 5173 端口）'
$stoppedSomething = $false

$vitePidFile = Join-Path $logDir 'vite.pid'
if (Test-Path $vitePidFile) {
    $vitePid = (Get-Content $vitePidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($vitePid -and $vitePid.Trim() -match '^\d+$') {
        $vitePid = [int]$vitePid.Trim()
        if (Get-Process -Id $vitePid -ErrorAction SilentlyContinue) {
            Write-Info "关闭 Vite 窗口（PID $vitePid 及其子进程）"
            & taskkill /T /F /PID $vitePid 2>$null | Out-Null
            $stoppedSomething = $true
        }
    }
    Remove-Item $vitePidFile -Force -ErrorAction SilentlyContinue
}

$listeners = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
    foreach ($procId in ($listeners | Select-Object -ExpandProperty OwningProcess -Unique)) {
        if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
            Write-Info "结束占用 5173 端口的进程（PID $procId）"
            & taskkill /T /F /PID $procId 2>$null | Out-Null
            $stoppedSomething = $true
        }
    }
}

Start-Sleep -Seconds 1
if ((Test-Tcp -Port 5173) -or $stoppedSomething) {
    Write-Ok '前端已停止'
} else {
    Write-Info '前端未在运行'
}

# ---------- 2. 停止 AI 助手 ----------
Write-Step '2/4' '停止 AI 助手（8787 端口）'
$assistantPidFile = Join-Path $logDir 'assistant.pid'
$assistantKilled = $false
if (Test-Path $assistantPidFile) {
    $assistantPid = (Get-Content $assistantPidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($assistantPid -and $assistantPid.Trim() -match '^\d+$') {
        if (Get-Process -Id ([int]$assistantPid.Trim()) -ErrorAction SilentlyContinue) {
            Write-Info "关闭助手窗口（PID $assistantPid 及其子进程）"
            & taskkill /T /F /PID ([int]$assistantPid.Trim()) 2>$null | Out-Null
            $assistantKilled = $true
        }
    }
    Remove-Item $assistantPidFile -Force -ErrorAction SilentlyContinue
}
$assistantListeners = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($assistantListeners) {
    foreach ($procId in ($assistantListeners | Select-Object -ExpandProperty OwningProcess -Unique)) {
        if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
            Write-Info "结束占用 8787 端口的进程（PID $procId）"
            & taskkill /T /F /PID $procId 2>$null | Out-Null
            $assistantKilled = $true
        }
    }
}
Start-Sleep -Seconds 1
if ($assistantKilled -or (Test-Tcp -Port 8787)) {
    Write-Ok 'AI 助手已停止'
} else {
    Write-Info 'AI 助手未在运行'
}
# ---------- 3. 停止 Supabase ----------
Write-Step '3/4' '停止本地 Supabase 容器'
$supaCmd = Get-Command supabase -ErrorAction SilentlyContinue
if ($supaCmd) {
    if ($RemoveVolumes) {
        Write-Warn '使用 -RemoveVolumes：将删除本地数据库数据（不可恢复）'
        & supabase stop --no-backup
    } else {
        & supabase stop
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Ok 'Supabase 已停止（数据保留在 Docker volume 中，下次启动可继续使用）'
    } else {
        Write-Warn 'supabase stop 返回非 0，可能原本就没有运行；可执行 supabase status 确认'
    }
} else {
    Write-Warn '未找到 supabase 命令，跳过（若容器仍在运行，可手动执行 docker stop）'
}

# ---------- 3. Docker Desktop ----------
Write-Step '4/4' 'Docker Desktop'
if ($QuitDocker) {
    $dockerDesktops = Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
    if ($dockerDesktops) {
        $dockerDesktops | Stop-Process -Force
        Write-Ok 'Docker Desktop 已退出'
    } else {
        Write-Info 'Docker Desktop 未在运行'
    }
} else {
    Write-Info 'Docker Desktop 保持运行（如需一起退出，运行: .\stop-atomic-crm.ps1 -QuitDocker）'
}

Write-Host ''
Write-Host '==============================================================' -ForegroundColor DarkCyan
Write-Host '                        已停止' -ForegroundColor Green
Write-Host '==============================================================' -ForegroundColor DarkCyan
Write-Host '  重新启动: 双击 start-atomic-crm.cmd' -ForegroundColor Gray
Write-Host '  数据位置: Docker volume（supabase_db_atomic-crm-demo 等）' -ForegroundColor DarkGray
Write-Host '==============================================================' -ForegroundColor DarkCyan

if ($transcribing) { try { Stop-Transcript | Out-Null } catch { } }
if (-not $NoPause) {
    Write-Host ''
    Write-Host '按回车键关闭本窗口...' -ForegroundColor DarkGray
    Read-Host | Out-Null
}
exit 0
