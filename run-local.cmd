@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js and run this file again.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is required. Install Node.js with npm and run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\vite\package.json" (
  echo Installing dependencies for the first run...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto failed
)

echo Building the local app...
call npm run build
if errorlevel 1 goto failed

echo.
echo Open http://127.0.0.1:4173/mdpro/ in your browser.
echo Keep this window open while using the app. Close it to stop the server.
echo.
call npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
exit /b %errorlevel%

:failed
echo Local app setup failed. See the error above.
pause
exit /b 1
