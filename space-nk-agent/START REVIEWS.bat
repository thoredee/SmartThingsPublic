@echo off
set GEMINI_API_KEY=AIzaSyBY60oruxrsCIbDb49cyeHsfhuPRk365AA
cd /d "%~dp0"
echo Starting Space NK Review Agent...
start /b python app.py
echo Waiting for app to start...
timeout /t 4 /nobreak >nul
start http://localhost:5000
echo.
echo App is running. Close this window when you are done.
pause
