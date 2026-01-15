# export_pdf.py
from io import BytesIO
from flask import Blueprint, send_file, jsonify, render_template_string
import pandas as pd
import os

bp = Blueprint('export_pdf', __name__)

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
EXCEL_PATH = os.path.join(DATA_DIR, "projects.xlsx")

DEFAULT_COLUMNS = [
    "No", "BRD No", "Project/Fitur", "Link BRD", "PIC", "Contact Person",
    "Status", "Priority", "Tanggal Submit", "Tanggal Completed", "Catatan"
]

try:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import mm
    REPORTLAB_AVAILABLE = True
except Exception:
    REPORTLAB_AVAILABLE = False

def read_df_safe():
    try:
        if not os.path.exists(EXCEL_PATH):
            cols = DEFAULT_COLUMNS.copy()
            return pd.DataFrame(columns=cols)
        df = pd.read_excel(EXCEL_PATH, engine="openpyxl").fillna("")
        for col in DEFAULT_COLUMNS:
            if col not in df.columns:
                df[col] = ""
        try:
            df['No'] = range(1, len(df) + 1)
        except Exception:
            pass
        cols_present = [c for c in DEFAULT_COLUMNS if c in df.columns]
        df = df[cols_present]
        return df
    except Exception:
        return pd.DataFrame(columns=DEFAULT_COLUMNS)

@bp.route("/api/projects/export/pdf", methods=["GET"])
def export_projects_pdf():
    if not REPORTLAB_AVAILABLE:
        return jsonify({"error": "ReportLab not installed", "detail": "Use /api/projects/export/pdf-fallback"}), 501
    try:
        df = read_df_safe()
        headers = DEFAULT_COLUMNS.copy()
        data = [headers]
        for _, row in df.iterrows():
            row_vals = []
            for col in headers:
                val = row.get(col, "")
                if pd.isna(val):
                    val = ""
                else:
                    val = str(val)
                row_vals.append(val)
            data.append(row_vals)
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4),
                                leftMargin=12*mm, rightMargin=12*mm,
                                topMargin=12*mm, bottomMargin=12*mm)
        styles = getSampleStyleSheet()
        cell_style = ParagraphStyle('cell_style', parent=styles['Normal'], fontSize=8, leading=10)
        table_data = []
        for r in data:
            row_cells = []
            for cell in r:
                p = Paragraph(cell.replace('\n', '<br/>'), cell_style)
                row_cells.append(p)
            table_data.append(row_cells)
        col_weights = []
        for col in headers:
            if col in ('Project/Fitur', 'Catatan'):
                col_weights.append(3.5)
            elif col in ('Link BRD',):
                col_weights.append(2.5)
            elif col in ('BRD No', 'PIC', 'Status', 'Priority'):
                col_weights.append(1.2)
            elif col in ('Tanggal Submit', 'Tanggal Completed'):
                col_weights.append(1.0)
            elif col == 'No':
                col_weights.append(0.6)
            else:
                col_weights.append(1.0)
        page_width, _ = landscape(A4)
        usable_width = page_width - (doc.leftMargin + doc.rightMargin)
        total_weight = sum(col_weights)
        col_widths = [(w / total_weight) * usable_width for w in col_weights]
        tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
        tbl_style = TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f3f4f6')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#111827')),
            ('ALIGN', (0,0), (0,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('GRID', (0,0), (-1,-1), 0.25, colors.HexColor('#d1d5db')),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ])
        tbl_style.add('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold')
        tbl_style.add('FONTSIZE', (0,0), (-1,0), 9)
        tbl_style.add('FONTSIZE', (0,1), (-1,-1), 8)
        tbl.setStyle(tbl_style)
        story = []
        title_style = ParagraphStyle('title', parent=styles['Heading2'], alignment=0, fontSize=14, spaceAfter=6)
        story.append(Paragraph("Projects Export", title_style))
        story.append(Spacer(1, 6))
        story.append(tbl)
        doc.build(story)
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name="projects.pdf", mimetype="application/pdf")
    except Exception as e:
        return jsonify({"error": "PDF export failed", "detail": str(e)}), 500

@bp.route("/api/projects/export/pdf-fallback", methods=["GET"])
def export_projects_pdf_fallback():
    df = read_df_safe()
    if 'No' in df.columns:
        try:
            df['No'] = range(1, len(df) + 1)
        except Exception:
            pass
    else:
        df.insert(0, 'No', range(1, len(df) + 1))
    rows = df.to_dict(orient='records') if not df.empty else []
    html = """
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Projects - Printable</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#111}
        table{width:100%;border-collapse:collapse;table-layout:fixed;word-wrap:break-word}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px;vertical-align:top}
        th{background:#f3f4f6}
        .meta{margin-bottom:12px}
        @media print{ .no-print{display:none} }
      </style>
    </head>
    <body>
      <div class="meta">
        <h2>Projects Export</h2>
        <div class="no-print"><button onclick="window.print()">Print / Save as PDF</button></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>No</th><th>BRD No</th><th>Project/Fitur</th><th>Link BRD</th><th>PIC</th><th>Contact Person</th><th>Status</th><th>Priority</th><th>Tanggal Submit</th><th>Tanggal Completed</th><th>Catatan</th>
          </tr>
        </thead>
        <tbody>
          {% for r in rows %}
          <tr>
            <td>{{ r['No'] }}</td>
            <td>{{ r['BRD No'] }}</td>
            <td>{{ r['Project/Fitur'] }}</td>
            <td>{{ r['Link BRD'] }}</td>
            <td>{{ r['PIC'] }}</td>
            <td>{{ r['Contact Person'] }}</td>
            <td>{{ r['Status'] }}</td>
            <td>{{ r['Priority'] }}</td>
            <td>{{ r['Tanggal Submit'] }}</td>
            <td>{{ r['Tanggal Completed'] }}</td>
            <td>{{ r['Catatan'] }}</td>
          </tr>
          {% endfor %}
          {% if rows|length == 0 %}
          <tr><td colspan="11" style="text-align:center;color:#666">Tidak ada data</td></tr>
          {% endif %}
        </tbody>
      </table>
    </body>
    </html>
    """
    return render_template_string(html, rows=rows)
