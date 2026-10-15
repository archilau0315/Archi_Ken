# 一键打包 ArchiKen 部署文件（宝塔面板版）
# 双击本文件即可，完成后在 deploy/ 下生成 archiken-deploy.zip

$ErrorActionPreference = 'Stop'
$deploy = $MyInvocation.MyCommand.Path | Split-Path -Parent
$root   = Split-Path -Parent $deploy

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  ArchiKen 部署包生成器" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# ---------- 1. 前端构建（cloud 模式） ----------
Write-Host "[1/4] 前端构建（cloud 模式）..." -ForegroundColor Yellow
Push-Location $root
$env:VITE_APP_MODE = 'cloud'
# 前端不内置 API Key：公网页面的 JS 谁都能读，内置等于把钥匙贴在门上。
# 云端访问保护交给宝塔 Nginx 的「基础认证（Basic Auth）」，凭据不落前端。
$env:VITE_ARCHIKEN_API_KEY = ''
# 云端访问地址是主站子路径 https://www.kbitai.com.cn/aitools/aichiken/，
# 前端所有 API 请求都要带这个前缀，否则会打到主站根 /api 上去（404）。
$env:VITE_ARCHIKEN_API_PREFIX = '/aitools/aichiken'

# 注意：PS5 下 $ErrorActionPreference='Stop' 会把 npm 的 stderr 警告当成终止错误，
# 所以构建期间临时放宽，成败只认 $LASTEXITCODE。
$ErrorActionPreference = 'Continue'
npm.cmd run build:renderer > (Join-Path $deploy '_build.log') 2>&1
$buildCode = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($buildCode -ne 0) {
    Write-Host "前端构建失败！末尾日志：" -ForegroundColor Red
    Get-Content (Join-Path $deploy '_build.log') -Tail 25
    Pop-Location
    exit 1
}
$distIndex = Get-Content (Join-Path $root 'dist\index.html') -Raw
$frontendHash = if ($distIndex -match 'index-([A-Za-z0-9_-]+)\.js') { $Matches[1] } else { 'unknown' }
$gitHash = (git rev-parse --short HEAD 2>$null)
if (-not $gitHash) { $gitHash = 'nogit' } else { $gitHash = "$gitHash".Trim() }
$buildId = "$gitHash-$(Get-Date -Format 'yyyyMMddHHmmss')"
Pop-Location
Write-Host "     构建 ID: $buildId" -ForegroundColor Green
Write-Host "     前端 hash: $frontendHash" -ForegroundColor Green

# ---------- 2. 组装目录 ----------
Write-Host "[2/4] 组装打包目录..." -ForegroundColor Yellow
$stage = Join-Path $deploy '_stage'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
# 服务器上统一收进 /www/wwwroot/archi_ken/ 父目录，便于管理：
#   archi_ken/archiken/     后端容器编排 + 源码
#   archi_ken/archiken-web/ 前端静态资源
$base = Join-Path $stage 'archi_ken'
$svc = Join-Path $base 'archiken'
$web = Join-Path $base 'archiken-web'
New-Item -ItemType Directory -Path $svc, $web -Force | Out-Null

# 编排与构建文件
Copy-Item (Join-Path $deploy 'docker-compose.yml')   $svc
Copy-Item (Join-Path $deploy 'Dockerfile.kernel')    $svc
Copy-Item (Join-Path $deploy 'Dockerfile.server')    $svc
Copy-Item (Join-Path $deploy 'dockerignore')         (Join-Path $svc '.dockerignore')
Copy-Item (Join-Path $deploy '.env')                 $svc
Copy-Item (Join-Path $deploy 'DEPLOY_ON_BT_PANEL.md') (Join-Path $base '部署指南-宝塔面板.md')

# 把 .env 里的构建标识改写成本次构建 ID。
# 不改写的话，容器 /health 只会返回 dev-local，三端版本锚点校验就失效了。
# 注意：必须以「无 BOM 的 UTF-8」写回，否则 docker compose 读 .env 会报错。
$envPath = Join-Path $svc '.env'
$envText = [System.IO.File]::ReadAllText($envPath)
$envText = [regex]::Replace($envText, '(?m)^ARCHIKEN_BUILD_ID=.*$', "ARCHIKEN_BUILD_ID=$buildId")
[System.IO.File]::WriteAllText($envPath, $envText, (New-Object System.Text.UTF8Encoding($false)))

# 依赖与编译配置（Dockerfile.server 编译需要两个 tsconfig）
Copy-Item (Join-Path $root 'package.json')            $svc
Copy-Item (Join-Path $root 'package-lock.json')       $svc
Copy-Item (Join-Path $root 'tsconfig.server.json')    $svc
Copy-Item (Join-Path $root 'tsconfig.server.build.json') $svc

# 锁文件里的下载地址默认指向 registry.npmjs.org，而 npm 的 registry 配置不会覆盖它，
# 导致国内服务器 npm ci 极慢甚至超时。这里只改写「打包副本」；
# 仓库里的原锁文件保持不动，不影响桌面端开发环境。
# （npmmirror 是 npmjs 的完整镜像，tarball 一致，integrity 校验不受影响）
$lockPath = Join-Path $svc 'package-lock.json'
$lockText = [System.IO.File]::ReadAllText($lockPath)
$lockText = $lockText -replace 'registry\.npmjs\.org', 'registry.npmmirror.com'
[System.IO.File]::WriteAllText($lockPath, $lockText, (New-Object System.Text.UTF8Encoding($false)))

# 后端源码
Copy-Item -Recurse (Join-Path $root 'kernel') $svc
Copy-Item -Recurse (Join-Path $root 'server') $svc

# 清掉本地开发残留，避免镜像臃肿
Get-ChildItem -Path $svc -Recurse -Directory -Include '__pycache__','.data','.cache','node_modules' -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# 前端产物
Copy-Item -Recurse (Join-Path $root 'dist\*') $web

# 版本标识
@"
build_id=$buildId
frontend_hash=$frontendHash
git=$gitHash
time=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@ | Out-File -Encoding utf8 (Join-Path $svc 'BUILD_INFO.txt')

# ---------- 3. 校验 ----------
Write-Host "[3/4] 校验产物完整性..." -ForegroundColor Yellow
$need = @(
    'archi_ken/archiken/docker-compose.yml','archi_ken/archiken/Dockerfile.kernel','archi_ken/archiken/Dockerfile.server',
    'archi_ken/archiken/.dockerignore','archi_ken/archiken/.env','archi_ken/archiken/package.json','archi_ken/archiken/package-lock.json',
    'archi_ken/archiken/tsconfig.server.json','archi_ken/archiken/tsconfig.server.build.json','archi_ken/archiken/BUILD_INFO.txt',
    'archi_ken/archiken/kernel/main.py','archi_ken/archiken/kernel/requirements.txt','archi_ken/archiken/server/index.ts',
    'archi_ken/archiken-web/index.html'
)
$missing = @()
foreach ($n in $need) { if (-not (Test-Path (Join-Path $stage $n))) { $missing += $n } }
if ($missing.Count -gt 0) {
    Write-Host "缺少文件，已中止：" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "     14 项必需文件全部就位" -ForegroundColor Green

# ---------- 4. 打 ZIP ----------
Write-Host "[4/4] 生成 ZIP..." -ForegroundColor Yellow
$zip = Join-Path $deploy 'archiken-deploy.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
Remove-Item -Recurse -Force $stage
Remove-Item (Join-Path $deploy '_build.log') -Force -ErrorAction SilentlyContinue

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  打包完成：$zip" -ForegroundColor Green
Write-Host "  大小：${mb} MB" -ForegroundColor Green
Write-Host "  构建 ID：$buildId" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步见 zip 内的「部署指南-宝塔面板.md」" -ForegroundColor Cyan
Write-Host "文件位置：$zip" -ForegroundColor Cyan
