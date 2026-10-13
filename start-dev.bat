@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22 LTS from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Installing dependencies for the first time...
  call npm install
  if errorlevel 1 (
    echo Failed to install dependencies. Check your internet connection.
    pause
    exit /b 1
  )
)
echo Starting BREACH / INTEL on http://localhost:5173 ...
call npm run dev
pause
