@echo off
set GEMINI_API_KEY=PASTE_YOUR_KEY_HERE
cd /d "%~dp0"
start http://localhost:5000
python app.py
pause
