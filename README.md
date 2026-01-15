# Project Management Starter (Flask)

Instruksi singkat:
1. Buat virtual environment:
   - Windows: `python -m venv venv`
   - macOS/Linux: `python3 -m venv venv`
2. Aktifkan venv:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`
3. Install dependensi:
   `pip install -r requirements.txt`
4. Jalankan aplikasi:
   `python app.py`
5. Buka browser: http://127.0.0.1:5000/

Catatan:
- File data disimpan di `data/projects_filtered.xlsx`. Menulis langsung ke Excel rentan konflik jika banyak pengguna menulis bersamaan.
- Untuk produksi, pertimbangkan menggunakan database (SQLite/Postgres) dan mekanisme backup.
