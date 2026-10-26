@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\node.exe" (
  runtime\node.exe scripts\serve.mjs --open
  goto finished
)
where node >nul 2>nul
if errorlevel 1 (
  echo For no-install use, download flag-windows-x64.zip from:
  echo https://github.com/giwon4197/flag/releases/latest
  echo Or install Node.js 24 LTS from https://nodejs.org/
  pause
  exit /b 1
)
node scripts\launch.mjs
if errorlevel 1 goto failed
:finished
pause
exit /b
:failed
echo Setup failed. Check the error above and use Node.js 24 LTS.
pause
exit /b 1
