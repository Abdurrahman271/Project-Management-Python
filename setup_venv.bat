
@echo off
setlocal
set VENV=.venv
if not exist %VENV% ( python -m venv %VENV% )
call %VENV%\Scripts\activate
pip install -r requirements.txt
python.exe -m pip install --upgrade pip
python app.py
