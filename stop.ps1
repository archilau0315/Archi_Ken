# 筑审通 ArchiKen 一键停止：结束监听 4319 / 4318 / 5173 的进程。
$ErrorActionPreference = 'SilentlyContinue'

Write-Host ""
Write-Host "正在停止筑审通 ArchiKen 服务..." -ForegroundColor Yellow

$stopped = 0
foreach ($port in @(4319, 4318, 5173)) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $procId = $c.OwningProcess
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $procId -Force
      Write-Host "  已停止端口 $port（进程 $($proc.ProcessName), PID $procId）" -ForegroundColor Green
      $stopped += 1
    }
  }
}

if ($stopped -eq 0) {
  Write-Host "  没有运行中的服务（端口 4319/4318/5173 均空闲）。" -ForegroundColor Gray
} else {
  Write-Host ""
  Write-Host "已停止 $stopped 个服务进程。" -ForegroundColor Green
}
Write-Host ""
