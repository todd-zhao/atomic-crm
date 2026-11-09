#requires -Version 5.1
<#
.SYNOPSIS
    Atomic CRM 一键启动：Docker Desktop -> 本地 Supabase -> Vite 开发服务器。
.DESCRIPTION
    可在资源管理器中双击仓库根目录的 start-atomic-crm.cmd 运行，也可以在本目录执行：
        powershell -NoProfile -ExecutionPolicy Bypass -File .\start-atomic-crm.ps1
    脚本是幂等的：已经在运行的服务会被自动识别并跳过。
.PARAMETER NoBrowser
    启动成功后不自动打开浏览器。
.PARAMETER BackendOnly
    只启动 Supabase 后端，不启动前端。
.PARAMETER NoPause
    结束时不停留等待按键（供自动化/命令行调用）。
.PARAMETER ForceRestart
    即使前端已在运行，也重新拉起一个新的 Vite 窗口（旧窗口需自行关闭）。
.EXAMPLE
    .\start-atomic-crm.ps1
.EXAMPLE
    .\start-atomic-crm.ps1 -BackendOnly -NoPause
#>
[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$BackendOnly,
    [switch]$NoPause,
    [switch]$ForceRestart
)

$ErrorActionPreference = 'Continue'

# ---------- 基础工具 ----------
$repo = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
if (-not (Test-Path (Join-Path $repo 'package.json'))) {
    Write-Host "current directory is not the Atomic CRM repo: $repo" -ForegroundColor Red
    exit 1
}
Set-Location $repo

$logDir = Join-Path $repo '.debug\logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$logFile = Join-Path $logDir ('start-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$transcribing = $false
try { Start-Transcript -Path $logFile -Force | Out-Null; $transcribing = $true } catch { }

function Write-Step([string]$n, [string]$msg) {
    Write-Host ''
    Write-Host "[$n] $msg" -ForegroundColor Cyan
}
function Write-Ok([string]$msg) { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Info([string]$msg) { Write-Host "    $msg" -ForegroundColor Gray }
function Write-Warn([string]$msg) { Write-Host "    [!] $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg) { Write-Host "    [X] $msg" -ForegroundColor Red }

function Stop-TranscriptIfActive {
    if ($script:transcribing) { try { Stop-Transcript | Out-Null } catch { }; $script:transcribing = $false }
}

function Exit-Fail([string]$message, [string]$hint) {
    Write-Host ''
    Write-Err $message
    if ($hint) { Write-Info $hint }
    Write-Info "完整日志: $logFile"
    Stop-TranscriptIfActive
    if (-not $NoPause) { Write-Host ''; Read-Host '按回车键退出' | Out-Null }
    exit 1
}

function Test-Tcp {
    param([int]$Port, [string]$Target = '127.0.0.1')
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $ar = $client.BeginConnect($Target, $Port, $null, $null)
        if (-not $ar.AsyncWaitHandle.WaitOne(700, $false)) { return $false }
        $client.EndConnect($ar)
        return $true
    } catch {
        return $false
    } finally {
        try { $client.Close() } catch { }
    }
}

function Wait-Tcp {
    param([int]$Port, [int]$TimeoutSec = 120)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Tcp -Port $Port) { return $true }
        Start-Sleep -Milliseconds 800
    }
    return $false
}

function Test-Administrator {
    try {
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
        return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch {
        return $false
    }
}

function Test-PortExcluded {
    param([int]$Port, [string]$Protocol = 'tcp')
    try {
        $lines = & netsh interface ipv4 show excludedportrange protocol=$Protocol 2>$null
    } catch {
        return $false
    }
    foreach ($line in $lines) {
        if ($line -match '^\s*(\d{1,5})\s+(\d{1,5})(\s+\*)?\s*$') {
            if ($Port -ge [int]$Matches[1] -and $Port -le [int]$Matches[2]) { return $true }
        }
    }
    return $false
}

# Hyper-V/NAT 重启后可能把 54321 划入 Windows 保留端口段，Docker 便无法绑定该端口。
# 临时停掉 winnat、重建 Supabase 容器、再恢复 winnat 即可释放端口（需要管理员权限）。
function Repair-SupabasePort {
    param([int]$Port = 54321)
    Write-Info '临时停止 Windows NAT 驱动（winnat）...'
    & net stop winnat | Out-Null
    Start-Sleep -Seconds 2
    try {
        & supabase stop | Out-Null
        & supabase start | Out-Null
    } finally {
        & net start winnat | Out-Null
    }
    Start-Sleep -Seconds 3
    return (Wait-Tcp -Port $Port -TimeoutSec 120)
}

function Get-EnvValue([string]$name) {
    $envFile = Join-Path $repo '.env.development'
    if (-not (Test-Path $envFile)) { return $null }
    $line = Select-String -Path $envFile -Pattern "^$([regex]::Escape($name))=(.+)$" | Select-Object -First 1
    if (-not $line) { return $null }
    return $line.Matches[0].Groups[1].Value.Trim()
}

function Invoke-Rest {
    param([string]$Uri, [hashtable]$Headers = @{})
    try {
        $r = Invoke-WebRequest -Uri $Uri -Headers $Headers -UseBasicParsing -TimeoutSec 15
        return $r
    } catch {
        return $null
    }
}

# ---------- 欢迎信息 ----------
Write-Host ''
Write-Host '==============================================================' -ForegroundColor DarkCyan
Write-Host '                 Atomic CRM  本地一键启动' -ForegroundColor White
Write-Host '        Docker Desktop  ->  本地 Supabase  ->  Vite 开发服务器' -ForegroundColor DarkGray
Write-Host '==============================================================' -ForegroundColor DarkCyan
Write-Host "    项目目录: $repo"
Write-Host "    运行日志: $logFile"

# ---------- 1. 运行环境检查 ----------
Write-Step '1/6' '检查运行环境（Node.js / npm）'
$nodeVersion = $null
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = ('{0}' -f (& node --version 2>$null)).Trim()
}
if (-not $nodeVersion) {
    Exit-Fail '找不到 Node.js' '请安装 Node.js 24 LTS：https://nodejs.org/en/download'
}
$nodeMajor = [int](($nodeVersion -replace '^v', '') -split '\.')[0]
if ($nodeMajor -lt 20) {
    Write-Warn "当前 Node.js 版本为 $nodeVersion，项目要求 Node.js 24 LTS，可能出现兼容问题"
} else {
    Write-Ok "Node.js $nodeVersion"
}
$npmVersion = $null
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = ('{0}' -f (& npm --version 2>$null)).Trim()
}
if (-not $npmVersion) { Exit-Fail '找不到 npm' 'npm 通常随 Node.js 一起安装，请重装 Node.js' }
Write-Ok "npm $npmVersion"

if (-not (Test-Path (Join-Path $repo '.env.development'))) {
    Exit-Fail '缺少 .env.development' '该文件保存本地 Supabase 地址与公钥，请从仓库恢复'
}
Write-Ok '.env.development 存在'

if (-not (Test-Path (Join-Path $repo 'node_modules'))) {
    Write-Info '首次运行：未找到 node_modules，正在安装前端依赖（可能需要几分钟）...'
    & npm install
    if ($LASTEXITCODE -ne 0) { Exit-Fail 'npm install 失败' '请检查网络/代理后手动执行 npm install' }
    Write-Ok '前端依赖安装完成'
} else {
    Write-Ok '前端依赖已安装（node_modules 存在）'
}

# ---------- 2. Docker 引擎 ----------
Write-Step '2/6' '检查 Docker 引擎（Supabase 依赖 Docker）'
$dockerVer = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerVer = ('{0}' -f (& docker info --format '{{.ServerVersion}}' 2>$null)).Trim()
}
if (-not $dockerVer) {
    Write-Info 'Docker 引擎未运行，尝试启动 Docker Desktop...'
    $exeCandidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'),
        (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Docker\Docker\Docker Desktop.exe')
    )
    $dockerExe = $exeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if (-not $dockerExe) {
        Exit-Fail '找不到 Docker Desktop' '请先安装 Docker Desktop（需启用 WSL2 后端）：https://www.docker.com/products/docker-desktop/'
    }
    Write-Info "启动: $dockerExe"
    Start-Process -FilePath $dockerExe | Out-Null
    $deadline = (Get-Date).AddMinutes(10)
    $waited = 0
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        $waited += 5
        if (Get-Command docker -ErrorAction SilentlyContinue) {
            $dockerVer = ('{0}' -f (& docker info --format '{{.ServerVersion}}' 2>$null)).Trim()
        }
        if ($dockerVer) { break }
        Write-Host "    等待 Docker 引擎就绪... ${waited}s" -ForegroundColor DarkGray
    }
    if (-not $dockerVer) {
        Exit-Fail 'Docker 引擎 10 分钟内未就绪' '请手动打开 Docker Desktop 并确认状态为 Running；若提示 WSL 需要更新，请先在管理员终端执行 wsl --update'
    }
}
Write-Ok "Docker 引擎运行中（$dockerVer）"

# ---------- 3. Supabase CLI ----------
Write-Step '3/6' '检查 Supabase CLI'
$supaCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supaCmd) {
    Write-Info '未找到 supabase 命令，正在全局安装（npm install -g supabase）...'
    & npm install -g supabase
    if ($LASTEXITCODE -ne 0) { Exit-Fail 'Supabase CLI 安装失败' '可尝试手动执行: npm install -g supabase' }
    $supaCmd = Get-Command supabase -ErrorAction SilentlyContinue
    if (-not $supaCmd) {
        Exit-Fail '安装了 Supabase CLI 但命令不可用' '请确认 npm 全局 bin 目录（通常是 %APPDATA%\npm）在 PATH 中，然后重开终端'
    }
}
$supaVersion = $null
if (Get-Command supabase -ErrorAction SilentlyContinue) {
    $supaVersion = ('{0}' -f (& supabase --version 2>$null)).Trim()
}
Write-Ok "Supabase CLI $supaVersion"

# ---------- 4. 本地 Supabase ----------
Write-Step '4/6' '启动本地 Supabase'
Write-Info '首次启动会下载约 7GB 的 Docker 镜像，可能耗时较久，请耐心等待...'
if (Test-Tcp -Port 54321) {
    Write-Ok 'Supabase 已在运行（127.0.0.1:54321），跳过启动'
} else {
    if (Test-PortExcluded -Port 54321) {
        Write-Warn '检测到 Windows（Hyper-V/NAT）保留了 54321 端口，Docker 无法绑定'
        if (Test-Administrator) {
            Write-Info '检测到管理员权限，正在自动释放端口并启动 Supabase（约 30-60 秒）...'
            $repaired = Repair-SupabasePort -Port 54321
            if (-not $repaired) {
                Exit-Fail '自动修复 54321 端口失败' '请重启电脑后再运行；或手动执行: net stop winnat -> supabase stop -> supabase start -> net start winnat'
            }
            Write-Ok '端口已释放，Supabase 启动完成'
        } else {
            Exit-Fail 'Windows 保留了 54321 端口，Docker 无法绑定' '请右键“以管理员身份运行” fix-supabase-port.cmd 自动修复，然后重新双击 start-atomic-crm.cmd；或重启电脑后再试。'
        }
    } else {
        & supabase start
        if ($LASTEXITCODE -ne 0) {
            Exit-Fail 'supabase start 失败' '常见原因: 54321-54324 端口被占用、Docker 资源不足、镜像拉取超时。可运行 supabase stop 后重试，或查看上方报错。'
        }
        Write-Ok 'Supabase 启动完成'
    }
}

if (-not (Wait-Tcp -Port 54321 -TimeoutSec 90)) {
    Exit-Fail 'Supabase API 端口 54321 无响应' '请执行 supabase status 查看容器状态；如果 Windows 保留了该端口，请以管理员身份运行 fix-supabase-port.cmd，或重启电脑后重试'
}

$publishableKey = Get-EnvValue 'VITE_SB_PUBLISHABLE_KEY'
if ($publishableKey) {
    $rest = Invoke-Rest -Uri 'http://127.0.0.1:54321/rest/v1/init_state?select=is_initialized' -Headers @{ apikey = $publishableKey }
    if ($rest) {
        try {
            $state = $rest.Content | ConvertFrom-Json
            if ($state -and $state[0].is_initialized -gt 0) {
                Write-Ok 'REST API 正常，数据库已初始化（已有管理员账号）'
            } else {
                Write-Ok 'REST API 正常'
                Write-Warn '数据库尚未初始化：首次打开应用时按向导创建第一个用户即可'
            }
        } catch {
            Write-Ok 'REST API 正常'
        }
    } else {
        Write-Warn 'REST API 暂时没有响应 .env.development 中的公钥（不影响后续使用）'
    }
    Write-Info 'Supabase Studio: http://localhost:54323/   邮件测试: http://localhost:54324/'
} else {
    Write-Warn '.env.development 中没有找到 VITE_SB_PUBLISHABLE_KEY，跳过 REST 校验'
}

# ---------- 5. AI 助手服务 ----------
Write-Step '5/6' '启动 AI 助手（BYOK，pi-durable）'
$assistantDir = Join-Path $repo 'assistant'
if (-not (Test-Path $assistantDir)) {
    Write-Warn '找不到 assistant 目录，跳过 AI 助手'
} else {
    if (-not (Test-Path (Join-Path $assistantDir 'node_modules'))) {
        Write-Info '首次运行：安装 assistant 依赖（npm install）...'
        Push-Location $assistantDir
        & npm install
        Pop-Location
    }
    $assistantEnvFile = Join-Path $assistantDir '.env'
    if (-not (Test-Path $assistantEnvFile)) {
        $exampleFile = Join-Path $assistantDir '.env.example'
        if (Test-Path $exampleFile) {
            $masterKey = ('{0}' -f (& node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")).Trim()
            $envContent = (Get-Content $exampleFile -Raw).Replace('ASSISTANT_ENCRYPTION_KEY=', "ASSISTANT_ENCRYPTION_KEY=$masterKey")
            [System.IO.File]::WriteAllText($assistantEnvFile, $envContent, (New-Object System.Text.UTF8Encoding($false)))
            Write-Info '已生成 assistant/.env（新加密主密钥，请另行备份）'
        }
    }
    if (Test-Tcp -Port 8787) {
        Write-Ok 'AI 助手已在运行（127.0.0.1:8787）'
    } elseif (-not (Test-Path $assistantEnvFile)) {
        Write-Warn '缺少 assistant/.env，跳过 AI 助手（参考 assistant/.env.example）'
    } else {
        $assistantCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Atomic CRM - AI assistant'
Set-Location '$assistantDir'
Write-Host 'Atomic CRM - AI assistant (BYOK)' -ForegroundColor Cyan
Write-Host '关闭本窗口即可停止助手服务' -ForegroundColor DarkGray
Write-Host ''
node --env-file=.env --import tsx src/index.ts
"@
        $assistantEncoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($assistantCommand))
        $assistantProc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-NoExit', '-EncodedCommand', $assistantEncoded) -PassThru
        $assistantProc.Id | Set-Content -Path (Join-Path $logDir 'assistant.pid') -Encoding ASCII
        Write-Info "助手服务已在新窗口启动（PID $($assistantProc.Id)），标题: Atomic CRM - AI assistant"
        $assistantReady = $false
        $assistantDeadline = (Get-Date).AddSeconds(90)
        while ((Get-Date) -lt $assistantDeadline) {
            Start-Sleep -Milliseconds 800
            try {
                $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/assistant/health' -TimeoutSec 3
                if ($health.ok) { $assistantReady = $true; break }
            } catch { }
        }
        if ($assistantReady) {
            Write-Ok 'AI 助手已就绪: http://127.0.0.1:8787/assistant'
        } else {
            Write-Warn 'AI 助手 90 秒内未就绪，请查看 "Atomic CRM - AI assistant" 窗口（CRM 其余功能不受影响）'
        }
    }
}
# ---------- 6. 前端 ----------
$appUrl = 'http://localhost:5173/'
if ($BackendOnly) {
    Write-Step '6/6' '跳过前端（-BackendOnly）'
} else {
    Write-Step '6/6' '启动前端（Vite 开发服务器）'
    $vitePidFile = Join-Path $logDir 'vite.pid'
    if ((Test-Tcp -Port 5173) -and $ForceRestart) {
        Write-Info '-ForceRestart: 正在关闭现有的前端进程...'
        if (Test-Path $vitePidFile) {
            $oldPid = (Get-Content $vitePidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
            if ($oldPid -and $oldPid.Trim() -match '^\d+$') {
                & taskkill /T /F /PID ([int]$oldPid.Trim()) 2>$null | Out-Null
            }
            Remove-Item $vitePidFile -Force -ErrorAction SilentlyContinue
        }
        $listeners = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
        if ($listeners) {
            foreach ($procId in ($listeners | Select-Object -ExpandProperty OwningProcess -Unique)) {
                & taskkill /T /F /PID $procId 2>$null | Out-Null
            }
        }
        Start-Sleep -Seconds 2
    }
    if (Test-Tcp -Port 5173) {
        Write-Ok '前端已在 http://localhost:5173/ 运行，跳过启动'
        Write-Info '如需重启前端: 先运行 stop-atomic-crm.cmd，再运行本脚本（或加 -ForceRestart）'
    } else {
        # 在新窗口中运行 Vite，日志和热更新信息都留在那个窗口里
        $viteCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Atomic CRM - Vite dev server'
Set-Location '$repo'
Write-Host 'Atomic CRM - Vite dev server' -ForegroundColor Cyan
Write-Host '关闭本窗口即可停止前端；后端请用 stop-atomic-crm.cmd 停止' -ForegroundColor DarkGray
Write-Host ''
npm run dev
"@
        $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($viteCommand))
        $viteProc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-NoExit', '-EncodedCommand', $encoded) -PassThru
        $viteProc.Id | Set-Content -Path $vitePidFile -Encoding ASCII
        Write-Info "Vite 已在独立窗口启动（PID $($viteProc.Id)），日志窗口标题: Atomic CRM - Vite dev server"
        if (-not (Wait-Tcp -Port 5173 -TimeoutSec 240)) {
            Exit-Fail 'Vite 未能在 240 秒内就绪' '请切换到 "Atomic CRM - Vite dev server" 窗口查看具体报错（常见原因: 5173 端口被占用、依赖缺失）'
        }
        Write-Ok 'Vite 已就绪: http://localhost:5173/'
    }
    if (-not $NoBrowser) {
        Write-Info '正在打开浏览器...'
        try { Start-Process $appUrl | Out-Null } catch { Write-Warn "自动打开浏览器失败，请手动访问 $appUrl" }
    }
}

# ---------- 汇总 ----------
Write-Host ''
Write-Host '==============================================================' -ForegroundColor DarkCyan
Write-Host '                        启动完成' -ForegroundColor Green
Write-Host '==============================================================' -ForegroundColor DarkCyan
Write-Host '  CRM 应用     : ' -NoNewline; Write-Host $appUrl -ForegroundColor White
Write-Host '  Supabase API : ' -NoNewline; Write-Host 'http://127.0.0.1:54321' -ForegroundColor White
Write-Host '  数据库       : ' -NoNewline; Write-Host 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -ForegroundColor White
Write-Host '  Studio       : ' -NoNewline; Write-Host 'http://localhost:54323/' -ForegroundColor White
Write-Host '  邮件测试     : ' -NoNewline; Write-Host 'http://localhost:54324/' -ForegroundColor White
Write-Host '  AI 助手      : ' -NoNewline; Write-Host 'http://127.0.0.1:8787/assistant/health' -ForegroundColor White
Write-Host ''
Write-Host '  演示账号     : ' -NoNewline; Write-Host 'admin@example.com / password123' -ForegroundColor Yellow
Write-Host ''
Write-Host '  停止服务     : 双击 stop-atomic-crm.cmd' -ForegroundColor Gray
Write-Host '  前端日志     : 查看标题为 "Atomic CRM - Vite dev server" 的窗口' -ForegroundColor Gray
Write-Host '  本窗口可以安全关闭，服务会继续运行' -ForegroundColor DarkGray
Write-Host '==============================================================' -ForegroundColor DarkCyan

Stop-TranscriptIfActive
if (-not $NoPause) {
    Write-Host ''
    Write-Host '按回车键关闭本窗口（Atomic CRM 继续运行）...' -ForegroundColor DarkGray
    Read-Host | Out-Null
}
exit 0
