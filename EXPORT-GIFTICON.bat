@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\node.exe" (
  runtime\node.exe scripts\export-gifticon.mjs
) else (
  node scripts\export-gifticon.mjs
)
pause
