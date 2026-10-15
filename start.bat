@echo off
REM 筑审通 ArchiKen 一键启动（Windows 双击运行）。
REM 本脚本转调同目录的 start.ps1（PowerShell 实现，便于维护）。
REM 失败原因会写入 start.log，便于排查。
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" 1>"%~dp0start.log" 2>&1
if errorlevel 1 (
  echo.
  echo ========================================
  echo   启动失败，原因如下（详见 start.log）：
  echo ========================================
  type "%~dp0start.log"
  echo.
)
pause
