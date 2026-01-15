#!/usr/bin/env python3
"""
generate_project.py

Membuat project Flask Company Profile lengkap dengan:
- UI responsif dan profesional (Tailwind CDN)
- Dropdown fitur Company Profile
- Order Management, QR Menu, Reservations
- API endpoints untuk orders, reservations, payment webhook, receipt
- SQLite DB placeholder
- Dockerfile, .gitignore, requirements, README
- Mengemas hasil ke company_profile.zip

Jalankan:
    python generate_project.py
"""
import os
import textwrap
from pathlib import Path
import zipfile
import sqlite3
import shutil
import sys

PROJECT = "company_profile"

FILES = {
    # Root
    "README.md": """# Company Profile (Flask) - Full Project

Instruksi singkat:
1. python -m venv .venv
2. .venv\\Scripts\\activate   (Windows cmd) OR . .venv\\Scripts\\Activate.ps1 (PowerShell)
3. pip install -r requirements.txt
4. python run.py 8001   # contoh jalankan di port 8001
5. Buka http://127.0.0.1:8001

Fitur utama:
- Halaman Company Profile (Home, About, Services, Contact)
- Dropdown fitur Company Profile
- Order Management dashboard
- QR Menu Order
- Reservations
- Payment webhook stub
- Electronic receipt endpoint
""",
    "requirements.txt": "Flask==2.2.5\npython-dotenv==1.0.0\n",
    ".gitignore": ".venv/\n__pycache__/\n*.pyc\ninstance/\ncompany_profile.db\n*.zip\n.env\n",
    "run.py": """#!/usr/bin/env python3
import os, sys
from app import create_app

def get_port():
    if len(sys.argv) > 1:
        try:
            return int(sys.argv[1])
        except ValueError:
            pass
    env_port = os.environ.get("PORT") or os.environ.get("FLASK_RUN_PORT")
    if env_port:
        try:
            return int(env_port)
        except ValueError:
            pass
    return 8001

if __name__ == '__main__':
    port = get_port()
    app = create_app()
    app.run(host='0.0.0.0', port=port, debug=True)
""",
    "Dockerfile": """FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8001
CMD ["sh", "-c", "python run.py ${PORT:-8001}"]
""",
    # App package
    "app/__init__.py": """import os
from flask import Flask
from .database import init_db

def create_app():
    app = Flask(__name__, static_folder='static', template_folder='templates')
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    init_db(app)
    from .routes import bp
    app.register_blueprint(bp)
    return app
""",
    "app/routes.py": """from flask import Blueprint, render_template, request, jsonify
from .database import (
    get_db, save_contact, create_order, list_orders, get_order,
    update_order_status, create_reservation, list_reservations,
    save_payment, get_receipt
)

bp = Blueprint('bp', __name__)

@bp.route('/')
def index():
    return render_template('index.html')

@bp.route('/about')
def about():
    return render_template('about.html')

@bp.route('/services')
def services():
    return render_template('services.html')

@bp.route('/contact')
def contact():
    return render_template('contact.html')

@bp.route('/order-management')
def order_management():
    return render_template('order_management.html')

@bp.route('/qr-menu')
def qr_menu():
    menu = [
        {'id':1,'name':'Spicy Chicken Burger','price':55000},
        {'id':2,'name':'Minuman Soda Buah','price':15000},
        {'id':3,'name':'Nasi Goreng Spesial','price':40000},
    ]
    return render_template('qr_menu.html', menu=menu)

@bp.route('/orders')
def orders_page():
    return render_template('orders.html')

@bp.route('/reservations')
def reservations_page():
    return render_template('reservations.html')

# API: contact
@bp.route('/api/contact', methods=['POST'])
def api_contact():
    data = request.get_json() or {}
    name = data.get('name','').strip()
    email = data.get('email','').strip()
    message = data.get('message','').strip()
    if not name or not email or not message:
        return jsonify({'status':'error','message':'Semua field wajib diisi'}), 400
    db = get_db()
    save_contact(db, name, email, message)
    return jsonify({'status':'ok','message':'Terima kasih, pesan Anda telah diterima.'})

# API: create order
@bp.route('/api/orders', methods=['POST'])
def api_create_order():
    data = request.get_json() or {}
    customer = data.get('customer','Guest')
    items = data.get('items',[])
    table = data.get('table')
    if not items:
        return jsonify({'status':'error','message':'Order harus memiliki item'}), 400
    db = get_db()
    order_id = create_order(db, customer, items, table)
    return jsonify({'status':'ok','order_id': order_id})

# API: list orders
@bp.route('/api/orders', methods=['GET'])
def api_list_orders():
    db = get_db()
    orders = list_orders(db)
    return jsonify({'status':'ok','orders': orders})

# API: get order detail
@bp.route('/api/orders/<int:order_id>', methods=['GET'])
def api_get_order(order_id):
    db = get_db()
    order = get_order(db, order_id)
    if not order:
        return jsonify({'status':'error','message':'Order tidak ditemukan'}), 404
    return jsonify({'status':'ok','order': order})

# API: update order status
@bp.route('/api/orders/<int:order_id>/status', methods=['POST'])
def api_update_order_status(order_id):
    data = request.get_json() or {}
    status = data.get('status')
    if not status:
        return jsonify({'status':'error','message':'Status wajib diisi'}), 400
    db = get_db()
    ok = update_order_status(db, order_id, status)
    if not ok:
        return jsonify({'status':'error','message':'Order tidak ditemukan'}), 404
    return jsonify({'status':'ok'})

# API: reservations
@bp.route('/api/reservations', methods=['POST'])
def api_create_reservation():
    data = request.get_json() or {}
    name = data.get('name')
    phone = data.get('phone')
    datetime = data.get('datetime')
    pax = data.get('pax',1)
    if not name or not phone or not datetime:
        return jsonify({'status':'error','message':'Field nama, phone, datetime wajib diisi'}), 400
    db = get_db()
    res_id = create_reservation(db, name, phone, datetime, pax)
    return jsonify({'status':'ok','reservation_id': res_id})

@bp.route('/api/reservations', methods=['GET'])
def api_list_reservations():
    db = get_db()
    res = list_reservations(db)
    return jsonify({'status':'ok','reservations': res})

# Payment webhook stub
@bp.route('/api/payment/webhook', methods=['POST'])
def api_payment_webhook():
    payload = request.get_json() or {}
    order_id = payload.get('order_id')
    status = payload.get('status')
    tx = payload.get('transaction_id')
    amount = payload.get('amount')
    db = get_db()
    save_payment(db, order_id, tx, amount, status)
    if status == 'PAID':
        update_order_status(db, order_id, 'Paid')
    return jsonify({'status':'ok'})

# Electronic receipt endpoint
@bp.route('/api/receipt/<int:order_id>', methods=['GET'])
def api_get_receipt(order_id):
    db = get_db()
    receipt = get_receipt(db, order_id)
    if not receipt:
        return jsonify({'status':'error','message':'Receipt tidak ditemukan'}), 404
    return jsonify({'status':'ok','receipt': receipt})
""",
    "app/database.py": """import sqlite3
import os
from flask import g

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'company_profile.db')
DB_PATH = os.path.abspath(DB_PATH)

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
    return db

def init_db(app=None):
    if not os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        c.execute('''
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer TEXT,
                table_no TEXT,
                status TEXT DEFAULT 'Open',
                total INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        c.execute('''
            CREATE TABLE order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                name TEXT,
                price INTEGER,
                qty INTEGER
            )
        ''')
        c.execute('''
            CREATE TABLE reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                phone TEXT,
                datetime TEXT,
                pax INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        c.execute('''
            CREATE TABLE payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                transaction_id TEXT,
                amount INTEGER,
                status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        c.execute('''
            CREATE TABLE receipts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()
    if app:
        @app.teardown_appcontext
        def close_connection(exception):
            db = getattr(g, '_database', None)
            if db is not None:
                db.close()

# contact helper
def save_contact(db, name, email, message):
    cur = db.cursor()
    cur.execute('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)', (name, email, message))
    db.commit()

# order helpers
def create_order(db, customer, items, table=None):
    cur = db.cursor()
    total = sum(int(i.get('price',0)) * int(i.get('qty',1)) for i in items)
    cur.execute('INSERT INTO orders (customer, table_no, total) VALUES (?, ?, ?)', (customer, table, total))
    order_id = cur.lastrowid
    for it in items:
        cur.execute('INSERT INTO order_items (order_id, name, price, qty) VALUES (?, ?, ?, ?)',
                    (order_id, it.get('name'), int(it.get('price',0)), int(it.get('qty',1))))
    content = {'order_id': order_id, 'customer': customer, 'items': items, 'total': total}
    cur.execute('INSERT INTO receipts (order_id, content) VALUES (?, ?)', (order_id, json_dump(content)))
    db.commit()
    return order_id

def list_orders(db):
    cur = db.cursor()
    cur.execute('SELECT id, customer, table_no, status, total, created_at FROM orders ORDER BY created_at DESC')
    rows = cur.fetchall()
    return [dict(r) for r in rows]

def get_order(db, order_id):
    cur = db.cursor()
    cur.execute('SELECT id, customer, table_no, status, total, created_at FROM orders WHERE id=?', (order_id,))
    r = cur.fetchone()
    if not r:
        return None
    order = dict(r)
    cur.execute('SELECT name, price, qty FROM order_items WHERE order_id=?', (order_id,))
    items = [dict(x) for x in cur.fetchall()]
    order['items'] = items
    return order

def update_order_status(db, order_id, status):
    cur = db.cursor()
    cur.execute('UPDATE orders SET status=? WHERE id=?', (status, order_id))
    db.commit()
    return cur.rowcount > 0

# reservations
def create_reservation(db, name, phone, datetime, pax):
    cur = db.cursor()
    cur.execute('INSERT INTO reservations (name, phone, datetime, pax) VALUES (?, ?, ?, ?)', (name, phone, datetime, pax))
    db.commit()
    return cur.lastrowid

def list_reservations(db):
    cur = db.cursor()
    cur.execute('SELECT id, name, phone, datetime, pax, created_at FROM reservations ORDER BY datetime DESC')
    return [dict(x) for x in cur.fetchall()]

# payments
def save_payment(db, order_id, tx, amount, status):
    cur = db.cursor()
    cur.execute('INSERT INTO payments (order_id, transaction_id, amount, status) VALUES (?, ?, ?, ?)', (order_id, tx, amount, status))
    db.commit()
    return cur.lastrowid

# receipts
def get_receipt(db, order_id):
    cur = db.cursor()
    cur.execute('SELECT id, content, created_at FROM receipts WHERE order_id=? ORDER BY created_at DESC LIMIT 1', (order_id,))
    r = cur.fetchone()
    if not r:
        return None
    return {'id': r[0], 'content': json_load(r[1]), 'created_at': r[2]}

def json_dump(obj):
    import json
    return json.dumps(obj, ensure_ascii=False)

def json_load(s):
    import json
    try:
        return json.loads(s)
    except:
        return s
""",
    # Templates
    "app/templates/base.html": """<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Company Profile</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link rel="stylesheet" href="{{ url_for('static', filename='css/custom.css') }}">
</head>
<body class="antialiased text-gray-800 bg-gray-50">
  <header class="bg-white shadow sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/" class="flex items-center space-x-3">
        <div class="w-10 h-10 bg-blue-600 text-white rounded flex items-center justify-center font-bold">CP</div>
        <div class="text-lg font-semibold">Company</div>
      </a>

      <!-- Desktop nav -->
      <nav class="hidden md:flex items-center space-x-6" aria-label="Main navigation">
        <a href="/" class="nav-link">Home</a>

        <!-- Dropdown fitur Company Profile -->
        <div class="relative dropdown" id="featuresDropdown">
          <button class="nav-link dropdown-toggle" aria-haspopup="true" aria-expanded="false" id="featuresBtn">
            Fitur Company Profile
            <svg class="ml-2 inline-block w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <div class="dropdown-menu" role="menu" aria-labelledby="featuresBtn">
            <div class="dropdown-grid">
              <div class="dropdown-col">
                <h4 class="dropdown-title">Order Management</h4>
                <a href="/order-management" class="dropdown-item">Order Management Dashboard</a>
                <a href="/qr-menu" class="dropdown-item">QR Menu Order</a>
                <a href="/orders" class="dropdown-item">Manajemen Pesanan</a>
                <a href="/api/payment/webhook" class="dropdown-item">Integrasi Pembayaran Digital</a>
                <a href="/reservations" class="dropdown-item">Manajemen Reservasi</a>
                <a href="/api/receipt/1" class="dropdown-item">Electronic Receipt</a>
              </div>
              <div class="dropdown-col">
                <h4 class="dropdown-title">Point of Sales</h4>
                <a href="#" class="dropdown-item">POS Digital</a>
                <a href="#" class="dropdown-item">Laporan Keuangan</a>
                <a href="#" class="dropdown-item">Laporan Penjualan</a>
                <a href="#" class="dropdown-item">Menu Orderan</a>
                <a href="#" class="dropdown-item">Data Pelanggan</a>
                <a href="#" class="dropdown-item">Reservasi</a>
              </div>
              <div class="dropdown-col">
                <h4 class="dropdown-title">Backoffice</h4>
                <a href="#" class="dropdown-item">Dashboard Backoffice</a>
                <a href="#" class="dropdown-item">Multi-outlet</a>
                <a href="#" class="dropdown-item">Manajemen Karyawan</a>
              </div>
            </div>
            <div class="dropdown-footer">
              <a href="/order-management" class="btn-primary">Lihat Semua Fitur Order Management</a>
            </div>
          </div>
        </div>

        <a href="/about" class="nav-link">About</a>
        <a href="/services" class="nav-link">Services</a>
        <a href="/contact" class="nav-link">Contact</a>
      </nav>

      <!-- Mobile menu button -->
      <div class="md:hidden">
        <button id="navToggle" class="p-2 rounded-md focus:outline-none" aria-label="Open menu">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div id="mobileMenu" class="md:hidden hidden bg-white border-t">
      <div class="px-6 py-4 space-y-2">
        <a href="/" class="block text-gray-700">Home</a>
        <button class="w-full text-left block text-gray-700 dropdown-mobile-toggle" data-target="mobileFeatures">Fitur Company Profile</button>
        <div id="mobileFeatures" class="mobile-dropdown hidden pl-4">
          <a href="/order-management" class="block py-1 text-gray-700">Order Management</a>
          <a href="/qr-menu" class="block py-1 text-gray-700">QR Menu Order</a>
          <a href="/reservations" class="block py-1 text-gray-700">Reservations</a>
        </div>
        <a href="/about" class="block text-gray-700">About</a>
        <a href="/services" class="block text-gray-700">Services</a>
        <a href="/contact" class="block text-gray-700">Contact</a>
      </div>
    </div>
  </header>

  <main class="py-8">
    <div class="max-w-6xl mx-auto px-6">
      {% block content %}{% endblock %}
    </div>
  </main>

  <footer class="bg-white mt-12 border-t">
    <div class="max-w-6xl mx-auto px-6 py-8 text-center text-sm text-gray-600">
      © Company • All rights reserved
    </div>
  </footer>

  <script src="{{ url_for('static', filename='js/main.js') }}"></script>
</body>
</html>
""",
    "app/templates/index.html": """{% extends 'base.html' %}
{% block content %}
<section class="bg-white rounded-lg shadow-sm overflow-hidden">
  <div class="grid md:grid-cols-2 gap-6 items-center p-8">
    <div>
      <h1 class="text-4xl md:text-5xl font-extrabold leading-tight">Solusi Digital untuk Bisnis Anda</h1>
      <p class="mt-4 text-gray-600">Website profesional, integrasi API, manajemen inventori, dan dukungan operasional untuk mempercepat pertumbuhan.</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <a href="/services" class="bg-blue-600 text-white px-5 py-3 rounded shadow">Lihat Layanan</a>
        <a href="/order-management" class="bg-white border border-blue-600 text-blue-600 px-5 py-3 rounded">Order Management</a>
      </div>
    </div>
    <div class="p-4">
      <div class="bg-gradient-to-br from-blue-50 to-white rounded-lg p-6 shadow-inner">
        <img src="{{ url_for('static', filename='images/hero-illustration.svg') }}" alt="illustration" class="w-full h-56 object-contain">
      </div>
    </div>
  </div>
</section>

<section class="mt-10">
  <h2 class="text-2xl font-bold">Layanan Kami</h2>
  <div class="mt-6 grid md:grid-cols-3 gap-6">
    <div class="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition">
      <h3 class="font-semibold">Web & Mobile</h3>
      <p class="mt-2 text-gray-600">Desain responsif, performa cepat, SEO friendly.</p>
    </div>
    <div class="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition">
      <h3 class="font-semibold">Integrasi API</h3>
      <p class="mt-2 text-gray-600">Integrasi pembayaran, kurir, dan sistem internal.</p>
    </div>
    <div class="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition">
      <h3 class="font-semibold">Support & Maintenance</h3>
      <p class="mt-2 text-gray-600">Monitoring, backup, dan pembaruan berkala.</p>
    </div>
  </div>
</section>
{% endblock %}
""",
    "app/templates/about.html": """{% extends 'base.html' %}
{% block content %}
<section class="py-8">
  <h1 class="text-3xl font-bold">Tentang Kami</h1>
  <p class="mt-4 text-gray-600">Kami membantu bisnis bertransformasi digital dengan solusi yang praktis dan terukur.</p>
  <div class="mt-6 grid md:grid-cols-2 gap-6">
    <div class="bg-white p-6 rounded shadow-sm">
      <h4 class="font-semibold">Visi</h4>
      <p class="mt-2 text-gray-600">Menjadi partner teknologi terpercaya.</p>
    </div>
    <div class="bg-white p-6 rounded shadow-sm">
      <h4 class="font-semibold">Misi</h4>
      <p class="mt-2 text-gray-600">Menyediakan solusi yang berdampak untuk operasional bisnis.</p>
    </div>
  </div>
</section>
{% endblock %}
""",
    "app/templates/services.html": """{% extends 'base.html' %}
{% block content %}
<section class="py-8">
  <h1 class="text-3xl font-bold">Layanan Kami</h1>
  <div class="mt-6 grid md:grid-cols-3 gap-6">
    <div class="bg-white p-6 rounded shadow-sm">
      <h4 class="font-semibold">Custom Website</h4>
      <p class="mt-2 text-gray-600">Desain & pengembangan sesuai kebutuhan.</p>
    </div>
    <div class="bg-white p-6 rounded shadow-sm">
      <h4 class="font-semibold">E-commerce & POS</h4>
      <p class="mt-2 text-gray-600">Solusi transaksi online & offline.</p>
    </div>
    <div class="bg-white p-6 rounded shadow-sm">
      <h4 class="font-semibold">Integrasi</h4>
      <p class="mt-2 text-gray-600">Payment gateway, kurir, ERP.</p>
    </div>
  </div>
</section>
{% endblock %}
""",
    "app/templates/contact.html": """{% extends 'base.html' %}
{% block content %}
<section class="py-8 max-w-2xl mx-auto">
  <h1 class="text-3xl font-bold">Kontak</h1>
  <p class="mt-2 text-gray-600">Isi form berikut untuk menghubungi kami.</p>

  <form id="contactForm" class="mt-4 space-y-3">
    <input id="name" class="w-full border p-2 rounded" placeholder="Nama" />
    <input id="email" class="w-full border p-2 rounded" placeholder="Email" />
    <textarea id="message" class="w-full border p-2 rounded" placeholder="Pesan"></textarea>
    <div class="flex items-center space-x-3">
      <button type="button" id="contactSubmit" class="bg-green-600 text-white px-4 py-2 rounded">Kirim</button>
      <div id="contactResult" class="text-sm"></div>
    </div>
  </form>
</section>

<script>
document.getElementById('contactSubmit').addEventListener('click', async function(){
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const message = document.getElementById('message').value.trim();
  const resultEl = document.getElementById('contactResult');
  resultEl.textContent = '';
  if (!name || !email || !message) {
    resultEl.textContent = 'Semua field wajib diisi.';
    resultEl.style.color = 'red';
    return;
  }
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({name, email, message})
    });
    const d = await res.json();
    if (d.status === 'ok') {
      resultEl.textContent = d.message;
      resultEl.style.color = 'green';
      document.getElementById('contactForm').reset();
    } else {
      resultEl.textContent = d.message || 'Terjadi kesalahan';
      resultEl.style.color = 'red';
    }
  } catch (err) {
    resultEl.textContent = 'Gagal mengirim, coba lagi.';
    resultEl.style.color = 'red';
  }
});
</script>
{% endblock %}
""",
    "app/templates/order_management.html": """{% extends 'base.html' %}
{% block content %}
<section class="py-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Order Management</h1>
    <div class="flex items-center space-x-3">
      <button id="refreshOrders" class="bg-gray-100 px-3 py-2 rounded">Refresh</button>
      <select id="filterStatus" class="border p-2 rounded">
        <option value="">All Status</option>
        <option>Open</option>
        <option>Preparing</option>
        <option>Ready</option>
        <option>Paid</option>
        <option>Cancelled</option>
      </select>
    </div>
  </div>

  <div class="mt-6 grid md:grid-cols-3 gap-6">
    <div class="col-span-2">
      <div id="ordersList" class="space-y-4"></div>
    </div>
    <div>
      <div class="bg-white p-4 rounded shadow-sm">
        <h3 class="font-semibold">Quick Actions</h3>
        <div class="mt-3 space-y-2">
          <a href="/qr-menu" class="block bg-blue-600 text-white px-4 py-2 rounded text-center">Open QR Menu</a>
          <a href="/reservations" class="block bg-green-600 text-white px-4 py-2 rounded text-center">Reservations</a>
        </div>
      </div>
      <div class="mt-4 bg-white p-4 rounded shadow-sm">
        <h4 class="font-semibold">Create Test Order</h4>
        <button id="createTestOrder" class="mt-2 bg-indigo-600 text-white px-3 py-2 rounded">Create</button>
      </div>
    </div>
  </div>
</section>

<div id="orderModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
  <div class="bg-white rounded-lg w-full max-w-2xl p-6">
    <div class="flex justify-between items-center">
      <h3 id="modalTitle" class="text-lg font-semibold">Order Detail</h3>
      <button id="closeOrderModal">✕</button>
    </div>
    <div id="modalBody" class="mt-4"></div>
  </div>
</div>

<script>
async function fetchOrders(){
  const res = await fetch('/api/orders');
  const data = await res.json();
  if (data.status !== 'ok') return;
  const list = document.getElementById('ordersList');
  list.innerHTML = '';
  data.orders.forEach(o=>{
    const el = document.createElement('div');
    el.className = 'bg-white p-4 rounded shadow-sm flex justify-between items-center';
    el.innerHTML = `<div>
      <div class="font-semibold">#${o.id} — ${o.customer || 'Guest'}</div>
      <div class="text-sm text-gray-600">${o.created_at} • Table: ${o.table_no || '-'}</div>
      <div class="text-sm">Total: Rp ${o.total}</div>
    </div>
    <div class="space-x-2">
      <button class="openBtn bg-blue-600 text-white px-3 py-1 rounded" data-id="${o.id}">Open</button>
      <button class="statusBtn bg-gray-100 px-3 py-1 rounded" data-id="${o.id}">Update</button>
    </div>`;
    list.appendChild(el);
  });
  document.querySelectorAll('.openBtn').forEach(b=>{
    b.addEventListener('click', async (e)=>{
      const id = e.target.dataset.id;
      const r = await fetch('/api/orders/' + id);
      const d = await r.json();
      if (d.status === 'ok'){
        const order = d.order;
        const body = document.getElementById('modalBody');
        body.innerHTML = `<div>
          <div class="font-semibold">Order #${order.id}</div>
          <div class="text-sm text-gray-600">Customer: ${order.customer}</div>
          <div class="mt-2">
            <h4 class="font-semibold">Items</h4>
            <ul class="list-disc ml-6">${order.items.map(i=>`<li>${i.qty}x ${i.name} — Rp ${i.price}</li>`).join('')}</ul>
          </div>
          <div class="mt-3">Total: Rp ${order.total}</div>
          <div class="mt-4 flex space-x-2">
            <button id="markPreparing" class="bg-yellow-400 px-3 py-1 rounded">Preparing</button>
            <button id="markReady" class="bg-green-500 text-white px-3 py-1 rounded">Ready</button>
            <button id="markPaid" class="bg-blue-600 text-white px-3 py-1 rounded">Paid</button>
            <a href="/api/receipt/${order.id}" target="_blank" class="bg-gray-200 px-3 py-1 rounded">Receipt</a>
          </div>
        </div>`;
        document.getElementById('orderModal').classList.remove('hidden');
        document.getElementById('markPreparing').addEventListener('click', ()=>updateStatus(order.id,'Preparing'));
        document.getElementById('markReady').addEventListener('click', ()=>updateStatus(order.id,'Ready'));
        document.getElementById('markPaid').addEventListener('click', ()=>updateStatus(order.id,'Paid'));
      }
    });
  });
  document.querySelectorAll('.statusBtn').forEach(b=>{
    b.addEventListener('click', async (e)=>{
      const id = e.target.dataset.id;
      const newStatus = prompt('Masukkan status baru (Preparing/Ready/Paid/Cancelled):');
      if (!newStatus) return;
      await updateStatus(id, newStatus);
    });
  });
}

async function updateStatus(id, status){
  const res = await fetch('/api/orders/' + id + '/status', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({status})
  });
  const d = await res.json();
  if (d.status === 'ok') {
    alert('Status updated');
    fetchOrders();
    document.getElementById('orderModal').classList.add('hidden');
  } else {
    alert('Gagal: ' + (d.message || ''));
  }
}

document.getElementById('refreshOrders').addEventListener('click', fetchOrders);
document.getElementById('closeOrderModal').addEventListener('click', ()=>document.getElementById('orderModal').classList.add('hidden'));
document.getElementById('createTestOrder').addEventListener('click', async ()=>{
  const payload = {customer:'Test User', items:[{name:'Spicy Chicken Burger', price:55000, qty:1}], table:'A1'};
  const r = await fetch('/api/orders', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
  const d = await r.json();
  if (d.status === 'ok') {
    alert('Order created: ' + d.order_id);
    fetchOrders();
  } else alert('Gagal membuat order');
});

fetchOrders();
</script>
""",
    "app/templates/qr_menu.html": """{% extends 'base.html' %}
{% block content %}
<section class="py-8 max-w-3xl mx-auto">
  <h1 class="text-2xl font-bold">QR Menu</h1>
  <p class="mt-2 text-gray-600">Pilih item lalu submit order. Simulasi scan QR untuk demo.</p>

  <div id="menuList" class="mt-4 grid md:grid-cols-2 gap-4">
    {% for m in menu %}
    <div class="bg-white p-4 rounded shadow-sm">
      <div class="flex justify-between items-center">
        <div>
          <div class="font-semibold">{{ m.name }}</div>
          <div class="text-sm text-gray-600">Rp {{ m.price }}</div>
        </div>
        <div>
          <input type="number" min="0" value="0" class="qtyInput border p-1 w-20" data-id="{{ m.id }}" data-name="{{ m.name }}" data-price="{{ m.price }}">
        </div>
      </div>
    </div>
    {% endfor %}
  </div>

  <div class="mt-6 flex justify-between items-center">
    <input id="customerName" class="border p-2 rounded w-1/2" placeholder="Nama (opsional)"/>
    <button id="submitOrder" class="bg-blue-600 text-white px-4 py-2 rounded">Submit Order</button>
  </div>

  <div id="orderResult" class="mt-4"></div>
</section>

<script>
document.getElementById('submitOrder').addEventListener('click', async ()=>{
  const qtys = document.querySelectorAll('.qtyInput');
  const items = [];
  qtys.forEach(q=>{
    const v = parseInt(q.value || '0');
    if (v > 0) items.push({name: q.dataset.name, price: parseInt(q.dataset.price), qty: v});
  });
  if (items.length === 0) {
    document.getElementById('orderResult').textContent = 'Pilih minimal 1 item.';
    return;
  }
  const payload = {customer: document.getElementById('customerName').value || 'Guest', items};
  const res = await fetch('/api/orders', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
  const d = await res.json();
  if (d.status === 'ok') {
    document.getElementById('orderResult').innerHTML = '<div class="text-green-600">Order berhasil. ID: ' + d.order_id + '</div>';
  } else {
    document.getElementById('orderResult').innerHTML = '<div class="text-red-600">Gagal: ' + (d.message || '') + '</div>';
  }
});
</script>
{% endblock %}
""",
    "app/templates/orders.html": """{% extends 'base.html' %}
{% block content %}
<section class="py-8">
  <h1 class="text-2xl font-bold">Orders</h1>
  <p class="mt-2 text-gray-600">Daftar order (API-driven).</p>
  <div id="ordersTable" class="mt-4"></div>
</section>

<script>
async function loadOrdersTable(){
  const res = await fetch('/api/orders');
  const d = await res.json();
  if (d.status !== 'ok') return;
  const el = document.getElementById('ordersTable');
  el.innerHTML = '<table class="w-full bg-white rounded shadow-sm"><thead><tr><th class="p-2">ID</th><th>Customer</th><th>Status</th><th>Total</th><th>Action</th></tr></thead><tbody>' +
    d.orders.map(o=>`<tr class="border-t"><td class="p-2">${o.id}</td><td>${o.customer}</td><td>${o.status}</td><td>Rp ${o.total}</td><td><a href="/order-management" class="text-blue-600">Manage</a></td></tr>`).join('') +
    '</tbody></table>';
}
loadOrdersTable();
</script>
{% endblock %}
""",
    "app/templates/reservations.html": """{% extends 'base.html' %}
{% block content %}
<section class="py-8 max-w-2xl mx-auto">
  <h1 class="text-2xl font-bold">Reservations</h1>
  <p class="mt-2 text-gray-600">Buat reservasi dan lihat daftar reservasi.</p>

  <form id="resForm" class="mt-4 space-y-2">
    <input id="res_name" class="w-full border p-2 rounded" placeholder="Nama" />
    <input id="res_phone" class="w-full border p-2 rounded" placeholder="No. Telepon" />
    <input id="res_datetime" class="w-full border p-2 rounded" placeholder="YYYY-MM-DD HH:MM" />
    <input id="res_pax" type="number" min="1" value="2" class="w-full border p-2 rounded" placeholder="Pax" />
    <div>
      <button type="button" id="resSubmit" class="bg-green-600 text-white px-4 py-2 rounded">Buat Reservasi</button>
    </div>
  </form>

  <div id="resList" class="mt-6"></div>
</section>

<script>
document.getElementById('resSubmit').addEventListener('click', async ()=>{
  const name = document.getElementById('res_name').value.trim();
  const phone = document.getElementById('res_phone').value.trim();
  const datetime = document.getElementById('res_datetime').value.trim();
  const pax = parseInt(document.getElementById('res_pax').value || '1');
  if (!name || !phone || !datetime) { alert('Isi semua field'); return; }
  const res = await fetch('/api/reservations', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, phone, datetime, pax})});
  const d = await res.json();
  if (d.status === 'ok') {
    alert('Reservasi dibuat: ' + d.reservation_id);
    loadReservations();
  } else alert('Gagal: ' + (d.message || ''));
});

async function loadReservations(){
  const r = await fetch('/api/reservations');
  const d = await r.json();
  if (d.status !== 'ok') return;
  const el = document.getElementById('resList');
  el.innerHTML = d.reservations.map(r=>`<div class="bg-white p-3 rounded shadow-sm mb-2"><div class="font-semibold">${r.name} • ${r.datetime}</div><div class="text-sm text-gray-600">Phone: ${r.phone} • Pax: ${r.pax}</div></div>`).join('');
}
loadReservations();
</script>
{% endblock %}
""",
    # Static assets
    "app/static/css/custom.css": """/* custom.css - global UI, dropdown, responsive, professional */

/* Base variables */
:root{
  --accent: #2563eb;
  --muted: #6b7280;
  --bg: #f8fafc;
  --card: #ffffff;
  --radius: 10px;
  --shadow-sm: 0 1px 2px rgba(16,24,40,0.05);
  --shadow-md: 0 6px 18px rgba(16,24,40,0.08);
}

/* Base */
html,body {
  height: 100%;
  background: var(--bg);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  color: #111827;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  margin: 0;
  padding: 0;
}

/* Nav link base */
.nav-link {
  color: #374151;
  font-weight: 500;
  padding: 8px 6px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
}
.nav-link:hover, .nav-link:focus {
  color: var(--accent);
  background: rgba(37,99,235,0.06);
  outline: none;
}

/* Dropdown container */
.dropdown { position: relative; }
.dropdown-toggle {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #374151;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
}
.dropdown-toggle:focus { outline: 2px solid rgba(37,99,235,0.15); }

/* Dropdown menu */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  min-width: 680px;
  background: var(--card);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  padding: 18px;
  display: none;
  z-index: 60;
  transform-origin: top left;
  transition: opacity .18s ease, transform .18s ease;
}

/* Show state controlled by JS toggling class 'open' */
.dropdown.open .dropdown-menu {
  display: block;
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Grid inside dropdown */
.dropdown-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.dropdown-col { min-width: 200px; }
.dropdown-title {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 8px;
}
.dropdown-item {
  display: block;
  padding: 8px 6px;
  color: #374151;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
}
.dropdown-item:hover, .dropdown-item:focus {
  background: rgba(37,99,235,0.06);
  color: var(--accent);
  outline: none;
}

/* Footer inside dropdown */
.dropdown-footer {
  margin-top: 12px;
  display:flex;
  justify-content:flex-end;
}
.btn-primary {
  background: var(--accent);
  color: #fff;
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
}
.btn-primary:hover { background: #1e40af; }

/* Mobile dropdown behavior */
.mobile-dropdown { padding-left: 8px; }
.dropdown-mobile-toggle {
  background: transparent;
  border: none;
  padding: 8px 0;
  font-weight: 600;
}

/* Accessibility focus ring */
a:focus, button:focus, input:focus {
  outline: 3px solid rgba(37,99,235,0.12);
  outline-offset: 2px;
  border-radius: 8px;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .dropdown-menu { min-width: 520px; left: auto; right: 0; }
  .dropdown-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .dropdown-menu { position: static; width: 100%; min-width: auto; box-shadow: none; padding: 12px; border-radius: 8px; }
  .dropdown-grid { grid-template-columns: 1fr; }
  .dropdown-footer { justify-content: center; }
}

/* Small UI polish for cards and sections */
.bg-card { background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow-sm); padding: 16px; }
.section-title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }

/* Utility */
.hidden { display: none !important; }
""",
    "app/static/js/main.js": """// main.js - dropdown and mobile menu handlers
document.addEventListener('DOMContentLoaded', function(){
  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  if (navToggle) navToggle.addEventListener('click', ()=> mobileMenu.classList.toggle('hidden'));

  // Desktop dropdown
  const featuresBtn = document.getElementById('featuresBtn');
  const featuresDropdown = document.getElementById('featuresDropdown');

  function closeDropdown() {
    featuresDropdown.classList.remove('open');
    featuresBtn.setAttribute('aria-expanded', 'false');
  }
  function openDropdown() {
    featuresDropdown.classList.add('open');
    featuresBtn.setAttribute('aria-expanded', 'true');
  }

  if (featuresBtn && featuresDropdown) {
    // toggle on click
    featuresBtn.addEventListener('click', function(e){
      e.stopPropagation();
      if (featuresDropdown.classList.contains('open')) closeDropdown(); else openDropdown();
    });

    // open on hover for desktop (optional)
    let hoverTimeout;
    featuresDropdown.addEventListener('mouseenter', ()=>{ clearTimeout(hoverTimeout); openDropdown(); });
    featuresDropdown.addEventListener('mouseleave', ()=>{ hoverTimeout = setTimeout(closeDropdown, 200); });

    // close on outside click
    document.addEventListener('click', function(e){
      if (!featuresDropdown.contains(e.target)) closeDropdown();
    });

    // keyboard accessibility: Esc to close
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeDropdown();
    });
  }

  // Mobile dropdown toggles inside mobile menu
  document.querySelectorAll('.dropdown-mobile-toggle').forEach(btn=>{
    btn.addEventListener('click', function(){
      const target = btn.dataset.target;
      const el = document.getElementById(target);
      if (el) el.classList.toggle('hidden');
    });
  });
});
""",
    "app/static/images/hero-illustration.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360" fill="none">
<rect width="600" height="360" rx="16" fill="#EFF6FF"/>
<g transform="translate(40,40)">
  <rect width="220" height="120" rx="8" fill="#fff" stroke="#DBEAFE"/>
  <rect x="240" width="220" height="120" rx="8" fill="#fff" stroke="#DBEAFE"/>
  <rect y="140" width="420" height="120" rx="8" fill="#fff" stroke="#DBEAFE"/>
</g>
</svg>
"""
}

def remove_existing_project(base_dir: Path):
    if base_dir.exists():
        print(f"Folder '{base_dir}' sudah ada. Menghapus folder lama...")
        shutil.rmtree(base_dir)
        print("Folder lama dihapus.")

def write_all_files(base_dir: Path):
    for rel_path, content in FILES.items():
        full_path = base_dir / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(textwrap.dedent(content))
    print(f"Created {len(FILES)} files under {base_dir}")

def create_sqlite_db(base_dir: Path):
    db_path = base_dir / "company_profile.db"
    if db_path.exists():
        print("Database file already exists:", db_path)
        return
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer TEXT,
            table_no TEXT,
            status TEXT DEFAULT 'Open',
            total INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            name TEXT,
            price INTEGER,
            qty INTEGER
        )
    ''')
    c.execute('''
        CREATE TABLE reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT,
            datetime TEXT,
            pax INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            transaction_id TEXT,
            amount INTEGER,
            status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print("Created SQLite DB at", db_path)

def make_zip(base_dir: Path, zip_name: str):
    zip_path = Path(zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(base_dir):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(base_dir.parent)
                z.write(file_path, arcname)
    print("Created zip:", zip_path)

def main():
    base_dir = Path.cwd() / PROJECT
    remove_existing_project(base_dir)
    write_all_files(base_dir)
    create_sqlite_db(base_dir)
    make_zip(base_dir, PROJECT + ".zip")
    print("\\nSelesai. File ZIP dan folder project telah dibuat.")
    print("Langkah selanjutnya:")
    print(f"  cd {PROJECT}")
    print("  python -m venv .venv")
    print("  .venv\\Scripts\\activate   (Windows cmd)  OR  . .venv\\Scripts\\Activate.ps1 (PowerShell)")
    print("  pip install -r requirements.txt")
    print("  python run.py 8001   # contoh jalankan di port 8001")
    print("Buka http://127.0.0.1:8001 di browser Anda.")

if __name__ == "__main__":
    main()
