@echo off
setlocal
cd /d "%~dp0"
echo.
echo WealthBot configuration check
echo =============================
echo.
where curl >nul 2>nul
if errorlevel 1 (
  echo curl is not available. Open this URL in your browser instead:
  echo http://localhost:5173/api/wealthbot/health
) else (
  curl -s http://localhost:5173/api/wealthbot/health
)
echo.
echo.
pause
