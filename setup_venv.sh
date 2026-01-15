#!/usr/bin/env sh
set -e
VENV=.venv
[ -d "$VENV" ] || python3 -m venv "$VENV"
. "$VENV/bin/activate"
pip install -r requirements.txt
python app.py
