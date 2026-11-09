#requires -Version 5.1
<#
.SYNOPSIS
    修复 Windows 保留 Supabase 端口（54321）导致 Docker 无法绑定的问题。
.DESCRIPTION
    Windows 的 Hyper-V/NAT（winnat）在重启后有时会把 54321 划入保留端口段，
    本地 Supabase 的 Kong 容器就绑定不了 API 端口，启动脚本会报
    "Supabase API 端口 54321 无响应"。

    修复方法：临时停止 winnat -> 重建 Supabase 容器 -> 恢复 winnat。
    本脚本需要管理员权限，直接双击 fix-supabase-port.cmd 会自动请求提升。
#>

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
if (-not $repo) { $repo = (Get-Location).Path }
Set-Location $repo

function Test-Administrator {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-Tcp {
    param([int]$Port, [int]$TimeoutMs = 700)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $ar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $ar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { return $false }
        $client.EndConnect($ar)
        return $true
    } catch {
        return $false
    } finally {
        try { $client.Close() } catch { }
    }
}

function Invoke-Supabase {
    param([string]$Action)
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase $Action | Out-Null
    } else {
        & npx supabase $Action | Out-Null
    }
    return [int]$LASTEXITCODE
}

if (-not (Test-Administrator)) {
    Write-Host '需要管理员权限。请右键 fix-supabase-port.cmd，选择“以管理员身份运行”。' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '==============================================================' -ForegroundColor Cyan
Write-Host '       修复 Windows 保留 Supabase 54321 端口' -ForegroundColor White
Write-Host '==============================================================' -ForegroundColor Cyan

if (Test-Tcp -Port 54321) {
    Write-Host '    端口 54321 当前正常，无需修复。如启动仍失败，请检查 Docker Desktop。' -ForegroundColor Green
    exit 0
}

Write-Host '    [1/4] 停止 Windows NAT 驱动（winnat）...' -ForegroundColor Gray
& net stop winnat | Out-Null
Start-Sleep -Seconds 2

Write-Host '    [2/4] 重启本地 Supabase（保留数据库数据）...' -ForegroundColor Gray
$exitCode = Invoke-Supabase 'stop'
$exitCode = Invoke-Supabase 'start'
if ($exitCode -ne 0) {
    Write-Host '    [X] supabase start 失败，请查看上方输出。' -ForegroundColor Red
    & net start winnat | Out-Null
    exit 1
}

Write-Host '    [3/4] 恢复 Windows NAT 驱动（winnat）...' -ForegroundColor Gray
& net start winnat | Out-Null
Start-Sleep -Seconds 3

Write-Host '    [4/4] 检查 54321 端口...' -ForegroundColor Gray
$ok = $false
for ($i = 0; $i -lt 20; $i++) {
    if (Test-Tcp -Port 54321) { $ok = $true; break }
    Start-Sleep -Milliseconds 800
}

if ($ok) {
    Write-Host ''
    Write-Host '    修复完成：Supabase API 已在 http://127.0.0.1:54321 响应。' -ForegroundColor Green
    Write-Host '    请重新运行 start-atomic-crm.cmd 启动完整环境。' -ForegroundColor Green
    exit 0
}

Write-Host ''
Write-Host '    端口仍不可用。建议重启电脑后再启动；如果反复出现，请把本窗口的输出发给维护者。' -ForegroundColor Red
exit 1
