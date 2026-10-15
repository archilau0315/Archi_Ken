@echo off
REM 筑审通 ArchiKen 一键停止：结束本项目拉起的内核 (4319)、业务服务 (4318)、前端 (5173) 进程。
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
pause
