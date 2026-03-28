@echo off
set GEMINI_API_KEY=AIzaSyBY60oruxrsCIbDb49cyeHsfhuPRk365AA
cd /d "%~dp0"
start http://localhost:5000
python app.py
pause
