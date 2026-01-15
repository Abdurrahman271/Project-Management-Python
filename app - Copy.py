# app.py
# Flask app: CRUD, Import/Backup, Dashboard Summary, Timeline Events, Gantt, Pages (index, dashboard, timeline, project_timeline, admin)
# Normalizes Status to: New, In Progress, Pending, Completed
# Dashboard priority distribution fixed to: Low, Medium, High, Urgent

import os
import uuid
import threading
import traceback
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, render_template, send_from_directory
from flask_cors import CORS
import pandas as pd

# -------------------------
# Paths & constants
# -------------------------
BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
EXCEL_PATH = os.path.join(DATA_DIR, "projects.xlsx")
UID_COL = "uid"
DEFAULT_COLUMNS = [
    "No", "BRD No", "Project/Fitur", "Link BRD", "PIC", "Contact Person",
    "Status", "Priority", "Tanggal Submit", "Tanggal Completed", "Catatan"
]
LOCK = threading.Lock()

# canonical statuses used across app
CANONICAL_STATUSES = ["New", "In Progress", "Pending", "Completed"]
# canonical priorities for dashboard (fixed order)
CANONICAL_PRIORITIES = ["Low", "Medium", "High", "Urgent"]

# -------------------------
# Helpers
# -------------------------
def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)

def normalize_status(value):
    if value is None:
        return "New"
    s = str(value).strip().lower()
    if s == "":
        return "New"
    if "new" in s and "in" not in s:
        return "New"
    if "in progress" in s or s in ("inprogress","on progress","onprogress","progress","on-progress"):
        return "In Progress"
    if "pending" in s:
        return "Pending"
    if "complete" in s or "done" in s:
        return "Completed"
    for cand in CANONICAL_STATUSES:
        if cand.lower() in s:
            return cand
    return "New"

def normalize_priority(value):
    if value is None:
        return ""
    return str(value).strip()

def ensure_data_file():
    ensure_dirs()
    if not os.path.exists(EXCEL_PATH):
        rows = []
        for i in range(1, 6):
            rows.append([
                i,
                f"BRD{100+i}",
                f"Sample Project {i}",
                f"https://example.com/brd/{100+i}",
                f"PIC {i}",
                "",
                "New",
                "Medium",
                (datetime.utcnow() - timedelta(days=30-i)).strftime("%Y-%m-%d"),
                (datetime.utcnow() - timedelta(days=30-i-3)).strftime("%Y-%m-%d") if i % 2 == 0 else "",
                f"Catatan {i}"
            ])
        df = pd.DataFrame(rows, columns=DEFAULT_COLUMNS)
        df[UID_COL] = [str(uuid.uuid4()) for _ in range(len(df))]
        with LOCK:
            df.to_excel(EXCEL_PATH, index=False, engine="openpyxl")

def read_df():
    try:
        ensure_data_file()
        df = pd.read_excel(EXCEL_PATH, engine="openpyxl").fillna("")
        # ensure required columns exist
        for col in DEFAULT_COLUMNS:
            if col not in df.columns:
                df[col] = ""
        # ensure UID column
        if UID_COL not in df.columns:
            df[UID_COL] = [str(uuid.uuid4()) for _ in range(len(df))]
        else:
            try:
                df[UID_COL] = df[UID_COL].astype(str).apply(lambda v: v.strip())
            except Exception:
                df[UID_COL] = df[UID_COL].apply(lambda v: str(v).strip() if v is not None else "")
        # normalize statuses/priorities
        if 'Status' in df.columns:
            df['Status'] = df['Status'].apply(lambda v: normalize_status(v))
        if 'Priority' in df.columns:
            df['Priority'] = df['Priority'].apply(lambda v: normalize_priority(v))
        # re-number No
        try:
            df['No'] = range(1, len(df) + 1)
        except Exception:
            pass
        # order columns
        cols = [c for c in DEFAULT_COLUMNS if c in df.columns]
        if UID_COL not in cols:
            cols.append(UID_COL)
        df = df[cols]
        return df
    except Exception:
        cols = DEFAULT_COLUMNS.copy()
        if UID_COL not in cols:
            cols.append(UID_COL)
        return pd.DataFrame(columns=cols)

def write_df(df):
    try:
        ensure_dirs()
        if 'No' in df.columns:
            try:
                df['No'] = range(1, len(df) + 1)
            except Exception:
                pass
        if UID_COL not in df.columns:
            df[UID_COL] = [str(uuid.uuid4()) for _ in range(len(df))]
        else:
            try:
                df[UID_COL] = df[UID_COL].astype(str).apply(lambda v: v.strip())
            except Exception:
                df[UID_COL] = df[UID_COL].apply(lambda v: str(v).strip() if v is not None else "")
        # normalize before saving
        if 'Status' in df.columns:
            df['Status'] = df['Status'].apply(lambda v: normalize_status(v))
        if 'Priority' in df.columns:
            df['Priority'] = df['Priority'].apply(lambda v: normalize_priority(v))
        with LOCK:
            df.to_excel(EXCEL_PATH, index=False, engine="openpyxl")
        return True
    except Exception:
        traceback.print_exc()
        return False

def backup_current(prefix="backup"):
    try:
        ensure_dirs()
        if os.path.exists(EXCEL_PATH):
            ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
            name = f"{prefix}_{ts}_{uuid.uuid4().hex[:8]}.xlsx"
            dest = os.path.join(BACKUP_DIR, name)
            with LOCK:
                df = read_df()
                df.to_excel(dest, index=False, engine="openpyxl")
            return dest
    except Exception:
        traceback.print_exc()
    return None

# -------------------------
# App & optional blueprints
# -------------------------
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Optional export blueprints (if present)
try:
    from export_excel import bp as export_excel_bp
    app.register_blueprint(export_excel_bp)
except Exception:
    pass
try:
    from export_pdf import bp as export_pdf_bp
    app.register_blueprint(export_pdf_bp)
except Exception:
    pass

# -------------------------
# Pages (unique endpoints)
# -------------------------
@app.route("/")
def index_page():
    # Halaman utama langsung Admin Panel
    return render_template("admin_panel.html")

@app.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")

@app.route("/timeline")
def timeline_page():
    return render_template("timeline.html")

@app.route("/project-timeline")
def project_timeline_page():
    # Ensure only one definition of this function exists in the file
    return render_template("project_timeline.html")

@app.route("/admin")
def admin_panel_page():
    return render_template("admin_panel.html")

@app.route("/project-management")
def project_management_page():
    return render_template("project_management.html")





# -------------------------
# CRUD APIs
# -------------------------
@app.route("/api/projects", methods=["GET"])
def api_projects_list():
    df = read_df()
    records = df.fillna("").to_dict(orient="records")
    for r in records:
        if UID_COL not in r or not r.get(UID_COL):
            r[UID_COL] = str(uuid.uuid4())
    return jsonify(records)

@app.route("/api/projects", methods=["POST"])
def api_projects_create():
    payload = request.get_json(force=True, silent=True) or {}
    brd = payload.get("BRD No") or payload.get("brd_no") or ""
    proj = payload.get("Project/Fitur") or payload.get("project") or ""
    if not brd or not proj:
        return jsonify({"error": "BRD No and Project/Fitur required"}), 400

    df = read_df()
    new = {}
    for col in DEFAULT_COLUMNS:
        val = payload.get(col)
        if val is None:
            key_alt = col.replace(" ", "").replace("/", "")
            val = payload.get(key_alt, "")
        if val is None:
            val = payload.get(col.lower(), "")
        if col == 'Status':
            val = normalize_status(val)
        if col == 'Priority':
            val = normalize_priority(val)
        new[col] = val if val is not None else ""
    try:
        new_no = int(df["No"].max()) + 1 if not df.empty and "No" in df.columns else (len(df) + 1)
    except Exception:
        new_no = len(df) + 1
    new["No"] = new_no
    new[UID_COL] = str(uuid.uuid4())

    new_df = pd.DataFrame([new])
    combined = pd.concat([df, new_df], ignore_index=True, sort=False)
    ok = write_df(combined)
    if not ok:
        return jsonify({"error": "Failed to save project"}), 500
    return jsonify(new), 201

@app.route("/api/projects/<uid>", methods=["PUT"])
def api_projects_update(uid):
    payload = request.get_json(force=True, silent=True) or {}
    df = read_df()
    uid_norm = str(uid).strip()
    mask = df[UID_COL].astype(str).str.strip() == uid_norm
    if not mask.any():
        return jsonify({"error": "Project not found"}), 404
    idx = df[mask].index[0]
    for k, v in payload.items():
        if k == 'Status':
            v = normalize_status(v)
        if k == 'Priority':
            v = normalize_priority(v)
        if k in df.columns:
            df.at[idx, k] = v
        else:
            df[k] = df.get(k, "")
            df.at[idx, k] = v
    ok = write_df(df)
    if not ok:
        return jsonify({"error": "Failed to save update"}), 500
    updated = df.loc[idx].fillna("").to_dict()
    return jsonify({k: ("" if pd.isna(v) else v) for k, v in updated.items()})

@app.route("/api/projects/<uid>", methods=["DELETE"])
def api_projects_delete(uid):
    df = read_df()
    uid_norm = str(uid).strip()
    mask = df[UID_COL].astype(str).str.strip() == uid_norm
    if not mask.any():
        return jsonify({"error": "Project not found"}), 404
    df2 = df[~mask].reset_index(drop=True)
    ok = write_df(df2)
    if not ok:
        return jsonify({"error": "Failed to delete project"}), 500
    return jsonify({"ok": True, "deleted": 1})

# -------------------------
# Import & Backups
# -------------------------
@app.route("/api/projects/import", methods=["POST"])
def api_projects_import():
    try:
        ensure_dirs()
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        f = request.files['file']
        mode = (request.form.get('mode') or 'append').lower()
        sheet = request.form.get('sheet') or 0
        if mode not in ('append', 'replace'):
            return jsonify({"error": "Invalid mode"}), 400
        try:
            uploaded_df = pd.read_excel(f, sheet_name=sheet, engine="openpyxl")
        except Exception as e:
            return jsonify({"error": "Failed to read Excel", "detail": str(e)}), 400

        uploaded_df.columns = [str(c).strip() for c in uploaded_df.columns]
        mapped_cols = {}
        for src in uploaded_df.columns:
            lc = src.lower().replace(" ", "").replace("_", "")
            for target in DEFAULT_COLUMNS:
                if lc == target.lower().replace(" ", "").replace("_", ""):
                    mapped_cols[target] = src
                    break

        rows = []
        for _, r in uploaded_df.iterrows():
            new_row = {}
            for col in DEFAULT_COLUMNS:
                if col == 'No':
                    new_row[col] = None
                    continue
                src = mapped_cols.get(col)
                val = ""
                if src is not None and src in uploaded_df.columns:
                    val = r.get(src, "")
                else:
                    if col in uploaded_df.columns:
                        val = r.get(col, "")
                if pd.isna(val):
                    val = ""
                if col == 'Status':
                    val = normalize_status(val)
                if col == 'Priority':
                    val = normalize_priority(val)
                new_row[col] = val
            rows.append(new_row)

        if len(rows) == 0:
            return jsonify({"error": "No rows found in uploaded file"}), 400

        new_df = pd.DataFrame(rows, columns=DEFAULT_COLUMNS)
        new_df[UID_COL] = [str(uuid.uuid4()) for _ in range(len(new_df))]

        if mode == 'append':
            existing = read_df()
            combined = pd.concat([existing, new_df], ignore_index=True, sort=False)
            ok = write_df(combined)
            if not ok:
                return jsonify({"error": "Failed to append data"}), 500
            return jsonify({"ok": True, "mode": "append", "imported": len(new_df)}), 200
        else:
            backup_path = backup_current(prefix="replace_backup")
            ok = write_df(new_df)
            if not ok:
                if backup_path and os.path.exists(backup_path):
                    with LOCK:
                        pd.read_excel(backup_path, engine="openpyxl").to_excel(EXCEL_PATH, index=False, engine="openpyxl")
                return jsonify({"error": "Failed to write replacement file"}), 500
            return jsonify({"ok": True, "mode": "replace", "imported": len(new_df), "backup": os.path.basename(backup_path) if backup_path else None}), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Import failed", "detail": str(e)}), 500

@app.route("/api/projects/backups", methods=["GET"])
def api_projects_backups_list():
    try:
        ensure_dirs()
        files = sorted([f for f in os.listdir(BACKUP_DIR) if f.lower().endswith('.xlsx')], reverse=True)
        return jsonify({"backups": files})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/projects/backups/<name>", methods=["GET"])
def api_projects_backup_download(name):
    try:
        ensure_dirs()
        path = os.path.join(BACKUP_DIR, name)
        if not os.path.exists(path):
            return jsonify({"error": "Backup not found"}), 404
        return send_from_directory(BACKUP_DIR, name, as_attachment=True)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------
# Dashboard summary
# -------------------------
@app.route("/api/dashboard/summary", methods=["GET"])
def api_dashboard_summary():
    try:
        df = read_df()
        total = len(df)

        status_series = df['Status'].fillna('').astype(str).apply(lambda v: normalize_status(v))
        status_counts = status_series.value_counts().to_dict()
        for s in CANONICAL_STATUSES:
            status_counts.setdefault(s, 0)

        priority_series = df['Priority'].fillna('').astype(str).apply(lambda v: normalize_priority(v))
        raw_priority_counts = priority_series.value_counts().to_dict()
        priority_counts = {p: int(raw_priority_counts.get(p, 0)) for p in CANONICAL_PRIORITIES}

        completed = int(status_series.str.lower().str.contains('completed').sum())

        per_month = {}
        try:
            dates = pd.to_datetime(df['Tanggal Submit'], errors='coerce')
            months = dates.dt.to_period('M').astype(str).fillna('')
            per_month = months.value_counts().sort_index().to_dict()
        except Exception:
            per_month = {}

        return jsonify({
            "total": total,
            "status_counts": status_counts,
            "priority_counts": priority_counts,
            "completed": completed,
            "per_month": per_month
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------
# Timeline / Events
# -------------------------
@app.route("/api/timeline/events", methods=["GET"])
def api_timeline_events():
    try:
        df = read_df()
        events = []
        for _, r in df.iterrows():
            brd = r.get('BRD No', '') or ''
            title = r.get('Project/Fitur', '') or ''
            pic = r.get('PIC', '') or ''
            submit = r.get('Tanggal Submit', '') or ''
            completed = r.get('Tanggal Completed', '') or ''
            if submit and str(submit).strip() != '':
                events.append({
                    "date": str(submit),
                    "type": "submit",
                    "brd": brd,
                    "title": title,
                    "pic": pic,
                    "note": r.get('Catatan', '') or ''
                })
            if completed and str(completed).strip() != '':
                events.append({
                    "date": str(completed),
                    "type": "completed",
                    "brd": brd,
                    "title": title,
                    "pic": pic,
                    "note": r.get('Catatan', '') or ''
                })
        try:
            events_sorted = sorted(events, key=lambda e: pd.to_datetime(e['date'], errors='coerce') or datetime.min)
        except Exception:
            events_sorted = events
        return jsonify({"events": events_sorted})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------
# Gantt APIs
# -------------------------
@app.route("/api/projects/gantt", methods=["GET"])
def api_projects_gantt_list():
    try:
        df = read_df()
        tasks = []
        for _, r in df.iterrows():
            uid = r.get(UID_COL) or str(uuid.uuid4())
            name = r.get('Project/Fitur', '') or ''
            start = r.get('Tanggal Submit', '') or ''
            end = r.get('Tanggal Completed', '') or ''
            if not end:
                try:
                    if start and str(start).strip() != '':
                        sd = pd.to_datetime(start, errors='coerce')
                        if pd.isna(sd):
                            start = datetime.utcnow().strftime("%Y-%m-%d")
                            end = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
                        else:
                            end = (sd + timedelta(days=7)).strftime("%Y-%m-%d")
                    else:
                        start = datetime.utcnow().strftime("%Y-%m-%d")
                        end = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
                except Exception:
                    start = datetime.utcnow().strftime("%Y-%m-%d")
                    end = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
            status = normalize_status(r.get('Status', '') or '')
            progress = 100 if 'completed' in status.lower() else (50 if 'in progress' in status.lower() else 0)
            dep = ""
            priority = normalize_priority(r.get('Priority', '') or '')
            custom_class = ""
            if 'urgent' in priority.lower():
                custom_class = 'gantt-urgent'
            elif 'high' in priority.lower():
                custom_class = 'gantt-high'
            tasks.append({
                "id": uid,
                "name": name or (r.get('BRD No') or ''),
                "start": str(start),
                "end": str(end),
                "progress": int(progress),
                "dependencies": dep,
                "custom_class": custom_class,
                "brd": r.get('BRD No', ''),
                "pic": r.get('PIC', ''),
                "priority": priority
            })
        return jsonify({"tasks": tasks})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/projects/gantt/<uid>", methods=["PUT"])
def api_projects_gantt_update(uid):
    try:
        payload = request.get_json(force=True, silent=True) or {}
        start = payload.get('start')
        end = payload.get('end')
        progress = payload.get('progress')
        df = read_df()
        uid_norm = str(uid).strip()
        mask = df[UID_COL].astype(str).str.strip() == uid_norm
        if not mask.any():
            return jsonify({"error": "Task not found"}), 404
        idx = df[mask].index[0]
        if start is not None:
            df.at[idx, 'Tanggal Submit'] = start
        if end is not None:
            df.at[idx, 'Tanggal Completed'] = end
        if progress is not None:
            try:
                p = int(progress)
                if p >= 100:
                    df.at[idx, 'Status'] = 'Completed'
                elif p > 0:
                    df.at[idx, 'Status'] = 'In Progress'
                else:
                    df.at[idx, 'Status'] = 'New'
            except Exception:
                pass
        ok = write_df(df)
        if not ok:
            return jsonify({"error": "Failed to save task update"}), 500
        updated = df.loc[idx].fillna("").to_dict()
        return jsonify({"ok": True, "updated": updated})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -------------------------
# Main
# -------------------------
if __name__ == "__main__":
    ensure_data_file()
    # Important: only one app.run, and no duplicate route functions above
    app.run(host="127.0.0.1", port=5000, debug=True)
