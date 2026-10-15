﻿﻿﻿# ArchiKen 云端部署脚本（PowerShell 5+ / 宝塔面板版）
# 用法：
#   1. 先填 deploy/.env 里的 API Key 和服务器信息
#   2. 修改本文件顶部的 $REMOTE_HOST / $REMOTE_USER / $REMOTE_WEB_ROOT
#   3. 本地执行：.\deploy\deploy.ps1
#
# 架构：宝塔 Nginx（反代 + HTTPS + 静态资源）→ Docker 容器 archiken-kernel:4319 + archiken-server:4318
# 关键：后端容器只绑定 127.0.0.1，公网无法直连，必须走宝塔 Nginx
#
# 流程：前端构建 → 生成版本标识 → 上传源码+dist → 远程 docker compose up → 健康检查 → 版本证据输出

$ErrorActionPreference = 'Stop'

# ====== 用户配置 ======
$REMOTE_HOST  = 'your-server-ip-or-domain'     # 阿里云服务器 IP 或域名
$REMOTE_USER  = 'root'                          # SSH 用户名（宝塔通常 root）
$REMOTE_PATH  = '/www/wwwroot/archiken'         # 远程部署目录（Docker 编排文件放这里）
$REMOTE_WEB   = '/www/wwwroot/archiken-web'     # 宝塔站点根目录（前端 dist/ 放这里）
$SSH_KEY      = $null                           # SSH 私钥路径；$null = 用默认 ~/.ssh/id_rsa
$USE_SCP      = $false                          # $true = 用 scp；$false = 用 rsync（需服务器装 rsync）
# ======================

$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$DEPLOY_DIR   = $PSScriptRoot

Write-Host "`n========== ArchiKen 部署开始（宝塔版） ==========" -ForegroundColor Cyan
Write-Host "项目根: $PROJECT_ROOT"
Write-Host "Docker 目录: $REMOTE_USER@$REMOTE_HOST`:$REMOTE_PATH"
Write-Host "Web 根目录: $REMOTE_USER@$REMOTE_HOST`:$REMOTE_WEB"

# ---------- Step 0: 版本标识（git hash + 时间戳） ----------
Push-Location $PROJECT_ROOT
$gitHash = (git rev-parse --short HEAD 2>$null).Trim()
if (-not $gitHash) { $gitHash = 'nogit' }
$buildId = "$gitHash-$(Get-Date -Format 'yyyyMMddHHmmss')"
Pop-Location
Write-Host "构建 ID: $buildId" -ForegroundColor Green

# ---------- Step 1: 前端构建（cloud 模式） ----------
Write-Host "`n[1/5] 前端构建 cloud 模式..." -ForegroundColor Yellow
Push-Location $PROJECT_ROOT
$env:VITE_APP_MODE = 'cloud'
$env:VITE_ARCHIKEN_API_KEY = (Select-String -Path "$DEPLOY_DIR\.env" -Pattern '^ARCHIKEN_API_KEY=(.+)' -ErrorAction SilentlyContinue).Matches.Groups[1].Value
if (-not $env:VITE_ARCHIKEN_API_KEY) { $env:VITE_ARCHIKEN_API_KEY = 'your-api-key-here' }

# PowerShell 5: 退出码不能走管道，分开执行
npm.cmd run build:renderer 2>&1 | Out-File -Encoding utf8 "$DEPLOY_DIR\_build.log"
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Host "前端构建失败！退出码=$exitCode" -ForegroundColor Red
    Get-Content "$DEPLOY_DIR\_build.log" -Tail 30
    exit $exitCode
}

# 提取前端构建产物 hash（index.html 里引用的 js 文件名含 hash）
$distIndex = Get-Content "$PROJECT_ROOT\dist\index.html" -Raw
if ($distIndex -match 'index-([A-Za-z0-9]+)\.js') { $frontendHash = $Matches[1] } else { $frontendHash = 'unknown' }
Write-Host "前端构建成功，产物 hash: $frontendHash" -ForegroundColor Green
Pop-Location

# ---------- Step 2: 准备上传包 ----------
Write-Host "`n[2/5] 准备上传包..." -ForegroundColor Yellow

# 先确保 .env 存在
$envFile = Join-Path $DEPLOY_DIR '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item "$DEPLOY_DIR\.env.example" $envFile
    Write-Host "已复制 .env.example → .env，请填写 ARCHIKEN_API_KEY 后重新执行" -ForegroundColor Red
    exit 1
}

# 两个上传目录：$REMOTE_PATH（Docker 文件）和 $REMOTE_WEB（前端静态资源）
$dockerUpload = Join-Path $DEPLOY_DIR '_upload_docker'
$webUpload    = Join-Path $DEPLOY_DIR '_upload_web'
if (Test-Path $dockerUpload) { Remove-Item -Recurse -Force $dockerUpload }
if (Test-Path $webUpload)    { Remove-Item -Recurse -Force $webUpload }
New-Item -ItemType Directory -Path $dockerUpload -Force | Out-Null
New-Item -ItemType Directory -Path $webUpload    -Force | Out-Null

# Docker 编排相关文件
Copy-Item "$DEPLOY_DIR\docker-compose.yml"    "$dockerUpload\docker-compose.yml"
Copy-Item "$DEPLOY_DIR\.env"                  "$dockerUpload\.env"
Copy-Item "$DEPLOY_DIR\Dockerfile.kernel"     "$dockerUpload\Dockerfile.kernel"
Copy-Item "$DEPLOY_DIR\Dockerfile.server"     "$dockerUpload\Dockerfile.server"

# 后端源码
Copy-Item -Recurse "$PROJECT_ROOT\kernel"     "$dockerUpload\kernel"
Copy-Item -Recurse "$PROJECT_ROOT\server"     "$dockerUpload\server"
Copy-Item          "$PROJECT_ROOT\package.json"      "$dockerUpload\package.json"
Copy-Item          "$PROJECT_ROOT\package-lock.json"  "$dockerUpload\package-lock.json" 2>$null

# 前端构建产物（直接放 web 根目录）
Copy-Item -Recurse "$PROJECT_ROOT\dist\*"     "$webUpload\"

# 版本标识文件
"build_id=$buildId`nfrontend_hash=$frontendHash`ntime=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`ngit=$gitHash" | Out-File -Encoding utf8 "$dockerUpload\BUILD_INFO.txt"

Write-Host "Docker 上传包: $dockerUpload"
Write-Host "Web 上传包:    $webUpload"

# ---------- Step 3: 上传 ----------
Write-Host "`n[3/5] 上传到远端服务器..." -ForegroundColor Yellow

$sshArgs = @('-o', 'StrictHostKeyChecking=no')
if ($SSH_KEY) { $sshArgs += @('-i', $SSH_KEY) }

# 创建远程目录
ssh @sshArgs "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p $REMOTE_PATH $REMOTE_WEB" 2>&1

# Docker 文件上传
Write-Host "  上传 Docker 编排文件..."
if ($USE_SCP) {
    scp @sshArgs -r "$dockerUpload\*" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"
} else {
    rsync -avz --progress --exclude='node_modules' --exclude='__pycache__' \
        "$dockerUpload/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/" 2>&1
}

# 前端静态资源上传（宝塔站点根目录）
Write-Host "  上传前端静态资源到宝塔站点..."
if ($USE_SCP) {
    scp @sshArgs -r "$webUpload\*" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_WEB}/"
} else {
    rsync -avz --delete --progress "$webUpload/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_WEB}/" 2>&1
}

# ---------- Step 4: 远程 Docker 构建 & 启动 ----------
Write-Host "`n[4/5] 远程构建 & 启动..." -ForegroundColor Yellow

# 注入 BUILD_ID 到 .env 并 docker compose build + up
$remoteCmd = @"
cd ${REMOTE_PATH} && \
sed -i 's/^ARCHIKEN_BUILD_ID=.*/ARCHIKEN_BUILD_ID=${buildId}/' .env && \
echo '=== 构建镜像 ===' && \
docker compose build --no-cache 2>&1 | tail -50 && \
echo '=== 启动容器 ===' && \
docker compose up -d && \
echo '=== 容器状态 ===' && \
docker compose ps && \
echo '=== 等待健康检查 (15s) ===' && \
sleep 15 && \
echo '=== 内核健康 ===' && \
curl -s http://127.0.0.1:4319/health && echo '' && \
echo '=== 业务健康 ===' && \
curl -s http://127.0.0.1:4318/health && echo ''
"@
$result = ssh @sshArgs "${REMOTE_USER}@${REMOTE_HOST}" $remoteCmd 2>&1
Write-Host $result

# ---------- Step 5: 版本证据输出 ----------
Write-Host "`n[5/5] 版本一致性确认..." -ForegroundColor Cyan
Write-Host "  构建 ID:      $buildId" -ForegroundColor Green
Write-Host "  前端 hash:    $frontendHash" -ForegroundColor Green
Write-Host "  Git commit:   $gitHash" -ForegroundColor Green

# 清理临时目录
Remove-Item -Recurse -Force $dockerUpload, $webUpload

# ---------- Step 6: 宝塔 Nginx 配置提示 ----------
Write-Host "`n========== 部署完成 ==========" -ForegroundColor Cyan
Write-Host "接下来需要在宝塔面板操作 Nginx 反代："
Write-Host ""
Write-Host "  1. 宝塔面板 → 网站 → 选中你的域名站点 → 设置 → 配置文件"
Write-Host "  2. 把 deploy/nginx.conf 中的 location 块粘贴到 server { } 内部"
Write-Host "  3. 保存，Nginx 自动 reload"
Write-Host "  4. 浏览器访问 https://你的域名/healthz 验证"
Write-Host ""
Write-Host "查看容器状态: ssh root@你的IP 'cd $REMOTE_PATH && docker compose ps'"
Write-Host "查看日志:     ssh root@你的IP 'cd $REMOTE_PATH && docker compose logs -f'"
