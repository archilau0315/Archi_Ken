# 筑审通 ArchiKen 单机版一键启动脚本（Windows）。
# 依次拉起：Python 计算内核 (4319) → L3 业务服务 (4318) → Vite 前端 (5173)，并自动打开浏览器。
# 依赖自检：Python、Node、pip 包、npm 包缺失时给出明确提示并尝试自动安装。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step([string]$msg) { Write-Host "  $msg" -ForegroundColor Gray }
function Write-Ok([string]$msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host "  [失败] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  筑审通 ArchiKen 一键启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ——— 1. 环境自检 ———
Write-Host "1/5 检查运行环境..." -ForegroundColor Yellow

# 取第一个可用命令（PATH 或别名）
function Resolve-Cmd([string[]]$names) {
  foreach ($n in $names) {
    $c = Get-Command $n -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
  }
  return $null
}

$python = Resolve-Cmd @('python', 'py')
if (-not $python) { Write-Fail "未找到 Python。请安装 Python 3.11+ 并勾选「Add to PATH」。"; exit 1 }
Write-Ok "Python: $python"

$node = Resolve-Cmd @('node')
if (-not $node) { Write-Fail "未找到 Node.js。请安装 Node.js 18+ 并加入 PATH。"; exit 1 }
Write-Ok "Node: $node"

$npm = Resolve-Cmd @('npm.cmd', 'npm')
if (-not $npm) { Write-Fail "未找到 npm。"; exit 1 }

# 内核 Python 依赖：缺失则自动 pip install（numpy 由 ifcopenshell 传递安装，无需单独检查）
Write-Step "检查 Python 依赖（fastapi / uvicorn / ifcopenshell / ifctester / openpyxl / reportlab）..."
$needPip = $false
foreach ($mod in @('fastapi', 'uvicorn', 'ifcopenshell', 'ifctester', 'openpyxl', 'reportlab')) {
  & $python -c "import $mod" 2>$null
  if ($LASTEXITCODE -ne 0) { $needPip = $true; break }
}
if ($needPip) {
  Write-Step "缺少 Python 依赖，正在自动安装（首次较慢）..."
  & $python -m pip install -r (Join-Path $root 'kernel\requirements.txt')
  if ($LASTEXITCODE -ne 0) { Write-Fail "Python 依赖安装失败，请手动执行：python -m pip install -r kernel\requirements.txt"; exit 1 }
}
Write-Ok "Python 依赖就绪"

# 前端 / L3 npm 依赖
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Step "首次运行，正在安装 npm 依赖（较慢）..."
  & $npm install
  if ($LASTEXITCODE -ne 0) { Write-Fail "npm 依赖安装失败，请手动执行：npm install"; exit 1 }
}
Write-Ok "npm 依赖就绪"

# ——— 2. 端口占用清理 ———
# 已占用 4319/4318/5173 的进程若是本项目旧实例则直接复用，不重复启动。
function Test-PortFree([int]$port) {
  $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  return ($null -eq $c)
}

# ——— 3. 启动 Python 计算内核 (4319) ———
Write-Host "2/5 启动计算内核（端口 4319）..." -ForegroundColor Yellow
if (Test-PortFree 4319) {
  Start-Process -FilePath $python -ArgumentList 'kernel\main.py' -WorkingDirectory $root -WindowStyle Hidden
} else {
  Write-Step "端口 4319 已有内核在运行，直接复用"
}

# ——— 4. 启动 L3 业务服务 (4318) ———
Write-Host "3/5 启动业务服务（端口 4318）..." -ForegroundColor Yellow
if (Test-PortFree 4318) {
  Start-Process -FilePath $npm -ArgumentList 'run server' -WorkingDirectory $root -WindowStyle Hidden
} else {
  Write-Step "端口 4318 已有服务在运行，直接复用"
}

# ——— 5. 启动 Vite 前端 (5173) ———
Write-Host "4/5 启动前端界面（端口 5173）..." -ForegroundColor Yellow
if (Test-PortFree 5173) {
  Start-Process -FilePath $npm -ArgumentList 'run dev' -WorkingDirectory $root -WindowStyle Hidden
} else {
  Write-Step "端口 5173 已有前端在运行，直接复用"
}

# ——— 6. 等待服务就绪并打开浏览器 ———
Write-Host "5/5 等待服务就绪..." -ForegroundColor Yellow
function Wait-HttpOk([string]$url, [int]$timeoutSec) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
      if ($r.StatusCode -eq 200) { return $true }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  return $false
}

$kernelOk = Wait-HttpOk 'http://localhost:4319/health' 60
if (-not $kernelOk) { Write-Fail "计算内核 60 秒内未就绪。请确认 Python 依赖完整。"; exit 1 }
Write-Ok "计算内核就绪"

$l3Ok = Wait-HttpOk 'http://localhost:4318/health' 60
if (-not $l3Ok) { Write-Fail "业务服务 60 秒内未就绪。"; exit 1 }
Write-Ok "业务服务就绪"

$webOk = Wait-HttpOk 'http://localhost:5173/' 90
if (-not $webOk) { Write-Fail "前端 90 秒内未就绪。"; exit 1 }
Write-Ok "前端就绪"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  启动完成！正在打开浏览器..." -ForegroundColor Green
Write-Host "  访问地址: http://localhost:5173/" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "提示：关闭本窗口不会停止服务。" -ForegroundColor Gray
Write-Host "停止服务：运行 stop.bat，或结束 python / node 进程。" -ForegroundColor Gray
Write-Host ""

Start-Process 'http://localhost:5173/'
