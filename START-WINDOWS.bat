@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the LTS version from https://nodejs.org/
  echo Then double-click START-WINDOWS.bat again.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Preparing the game for first use...
  call npm ci
  if errorlevel 1 goto failed
  call npm run build
  if errorlevel 1 goto failed
)
node scripts\serve.mjs --open
pause
exit /b
:failed
echo Setup failed. Check the error above and use Node.js 24 LTS.
pause
exit /b 1
