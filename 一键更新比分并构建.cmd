@echo off
cd /d "%~dp0"
echo Updating World Cup scores...
npm run update:scores
if errorlevel 1 (
  echo.
  echo Score update failed. Check the message above.
  pause
  exit /b 1
)
echo.
echo Building site...
npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Check the message above.
  pause
  exit /b 1
)
echo.
echo Done. Commit and push the changed files to redeploy Netlify.
pause
