#!/bin/bash
python -m venv venv
# macOS/Linux:
# source venv/bin/activate
# Windows:
# venv\Scripts\activate
pip install -r requirements.txt
python app.py
