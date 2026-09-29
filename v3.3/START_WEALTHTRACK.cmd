@echo off
setlocal
cd /d "%~dp0"
echo.
echo ==========================================
echo          WEALTHTRACK STARTER
echo ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js LTS, then run this file again.
  pause
  exit /b 1
)
if not exist "client\node_modules\vite\bin\vite.js" (
  echo Installing WealthTrack packages...
  call npm --prefix client install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo Installation failed. Check your internet connection and npm installation.
    pause
    exit /b 1
  )
)
echo Starting WealthTrack...
start "WealthTrack" /D "%~dp0client" cmd /d /c "node node_modules\vite\bin\vite.js --host 0.0.0.0"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"
echo.
echo WealthTrack is running at http://localhost:5173
echo Keep the WealthTrack window open while using the app.
echo.
endlocal
