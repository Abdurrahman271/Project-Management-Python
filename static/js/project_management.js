// static/js/project_management.js
// CRUD yang mempertahankan posisi tabel + View readonly modal + integrasi loader & notifications
(function(){
  'use strict';

  const API_BASE = '/api/projects';
  const API_SUMMARY = '/api/dashboard/summary';
  const API_IMPORT = '/api/projects/import';

  let dt = null;
  let modalInstance = null;

  // Fallback state
  let fallbackRows = [];      // full dataset
  let fallbackPage = 1;
  let fallbackPageSize = 10;

  const $ = (s) => document.querySelector(s);
  function toast(msg, type='success'){
    const t = document.createElement('div');
    t.textContent = msg;
    t.className = 'toast-lite';
    t.style.position='fixed'; t.style.right='18px'; t.style.bottom='18px';
    t.style.background = type==='error' ? '#ef4444' : '#10b981';
    t.style.color = '#fff'; t.style.padding='10px 14px'; t.style.borderRadius='8px'; t.style.zIndex=99999;
    document.body.appendChild(t); setTimeout(()=>t.remove(),3000);
  }
  function escapeHtml(s){ if(s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  async function fetchJSON(url, opts = {}) {
    const res = await fetch(url, opts);
    const text = await res.text().catch(()=> '');
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch(e){ throw new Error('Invalid JSON from ' + url); }
    if (!res.ok) {
      const err = (json && json.error) ? json.error : `HTTP ${res.status}`;
      throw new Error(err);
    }
    return json;
  }

  function statusBadge(val){
    const s = (val||'').toString().toLowerCase();
    const cls = s.includes('completed') ? 'badge-status-completed' :
                s.includes('progress') ? 'badge-status-inprogress' :
                s.includes('pending') ? 'badge-status-pending' : 'badge-status-new';
    return `<span class="badge-cell ${cls}">${escapeHtml(val||'')}</span>`;
  }
  function priorityBadge(val){
    const p = (val||'').toString().toLowerCase();
    const cls = p.includes('urgent') ? 'badge-priority-urgent' :
                p.includes('high') ? 'badge-priority-high' :
                p.includes('medium') ? 'badge-priority-medium' :
                p.includes('low') ? 'badge-priority-low' : 'badge-priority-default';
    return `<span class="badge-cell ${cls}">${escapeHtml(val||'')}</span>`;
  }

  function detectDataTables() {
    return !!(window.jQuery && window.jQuery.fn && window.jQuery.fn.DataTable);
  }

  function buildRowHtml(row, index) {
    const uid = row.uid || '';
    const link = row['Link BRD'] ? `<a href="${escapeHtml(row['Link BRD'])}" target="_blank" rel="noopener">${escapeHtml(row['Link BRD'])}</a>` : '';
    return `<tr data-uid="${escapeHtml(uid)}">
      <td>${index+1}</td>
      <td>${escapeHtml(row['BRD No']||'')}</td>
      <td>${escapeHtml(row['Project/Fitur']||'')}</td>
      <td>${link}</td>
      <td>${statusBadge(row['Status']||'')}</td>
      <td>${priorityBadge(row['Priority']||'')}</td>
      <td>${escapeHtml(row['Tanggal Submit']||'')}</td>
      <td>${escapeHtml(row['Tanggal Completed']||'')}</td>
      <td>${escapeHtml(row['PIC']||'')}</td>
      <td>${escapeHtml(row['Catatan']||'')}</td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-secondary btn-view" data-uid="${escapeHtml(uid)}" title="Lihat"><i class="fa-solid fa-eye"></i></button>
          <button class="btn btn-sm btn-primary btn-edit" data-uid="${escapeHtml(uid)}" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn btn-sm btn-danger btn-del" data-uid="${escapeHtml(uid)}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }

  function renderFallbackPage() {
    const tbody = document.querySelector('#tblProjectsPM tbody');
    const pager = document.getElementById('fallbackPager');
    const info = document.getElementById('fallbackInfo');
    const footerWrap = document.getElementById('fallbackPagination');

    if (!tbody || !pager || !info || !footerWrap) return;

    const rows = fallbackRows || [];
    const total = rows.length;
    const pageSize = (fallbackPageSize === -1) ? total || 1 : fallbackPageSize;
    const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
    if (fallbackPage > totalPages) fallbackPage = totalPages;

    const startIndex = (pageSize === -1) ? 0 : (fallbackPage - 1) * pageSize;
    const endIndex = (pageSize === -1) ? total : Math.min(total, startIndex + pageSize);

    const pageRows = (pageSize === -1) ? rows : rows.slice(startIndex, endIndex);

    tbody.innerHTML = pageRows.map((r, i) => buildRowHtml(r, startIndex + i)).join('');

    tbody.querySelectorAll('button.btn-view').forEach(b => b.addEventListener('click', ()=> openView(b.dataset.uid)));
    tbody.querySelectorAll('button.btn-edit').forEach(b => b.addEventListener('click', ()=> openEdit(b.dataset.uid)));
    tbody.querySelectorAll('button.btn-del').forEach(b => b.addEventListener('click', ()=> confirmDelete(b.dataset.uid)));

    info.textContent = `Showing ${total === 0 ? 0 : (startIndex + 1)} to ${total === 0 ? 0 : endIndex} of ${total} entries`;

    pager.innerHTML = '';
    const createPageItem = (label, page, disabled=false, active=false) => {
      const li = document.createElement('li');
      li.className = 'page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '');
      const a = document.createElement('a');
      a.className = 'page-link';
      a.textContent = label;
      if (!disabled && !active) a.addEventListener('click', (e)=> { e.preventDefault(); fallbackPage = page; renderFallbackPage(); });
      li.appendChild(a);
      return li;
    };

    pager.appendChild(createPageItem('Previous', Math.max(1, fallbackPage - 1), fallbackPage === 1));

    const maxButtons = 7;
    let start = Math.max(1, fallbackPage - 3);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

    if (start > 1) {
      pager.appendChild(createPageItem('1', 1, false, false));
      if (start > 2) {
        const li = document.createElement('li'); li.className = 'page-item disabled'; li.innerHTML = '<span class="page-link">…</span>'; pager.appendChild(li);
      }
    }

    for (let p = start; p <= end; p++) {
      pager.appendChild(createPageItem(String(p), p, false, p === fallbackPage));
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        const li = document.createElement('li'); li.className = 'page-item disabled'; li.innerHTML = '<span class="page-link">…</span>'; pager.appendChild(li);
      }
      pager.appendChild(createPageItem(String(totalPages), totalPages, false, false));
    }

    pager.appendChild(createPageItem('Next', Math.min(totalPages, fallbackPage + 1), fallbackPage === totalPages));

    footerWrap.style.display = total > 0 ? '' : 'none';
  }

  function initTable(rows) {
    fallbackRows = rows || [];
    const pageLengthSelect = document.getElementById('pageLengthSelect');
    const useDT = detectDataTables();

    if (useDT) {
      try {
        const initialLength = Number(pageLengthSelect.value);
        const lengthMenu = [[5,10,25,50,100,-1],[5,10,25,50,100,'All']];

        if (dt) {
          const info = dt.page.info();
          const currentPage = info.page;
          const currentSearch = dt.search();
          const currentOrder = dt.order();
          dt.clear();
          dt.rows.add(rows);
          dt.draw(false);
          if (currentSearch) dt.search(currentSearch).draw(false);
          if (currentOrder) dt.order(currentOrder).draw(false);
          dt.page(currentPage).draw(false);
          return;
        }

        dt = $('#tblProjectsPM').DataTable({
          data: rows,
          columns: [
            { title:"No", data:null, render:(d,t,r,meta)=> meta.row+1, width:'56px' },
            { title:"BRD No", data: d=> d['BRD No'] || '' },
            { title:"Project / Fitur", data: d=> d['Project/Fitur'] || '' },
            { title:"Link BRD", data: d=> d['Link BRD'] || '', render: data => data ? `<a href="${escapeHtml(data)}" target="_blank" rel="noopener">${escapeHtml(data)}</a>` : '', orderable:false },
            { title:"Status", data: d=> d['Status'] || '', render: data => statusBadge(data) },
            { title:"Priority", data: d=> d['Priority'] || '', render: data => priorityBadge(data) },
            { title:"Tanggal Submit", data: d=> d['Tanggal Submit'] || '' },
            { title:"Tanggal Completed", data: d=> d['Tanggal Completed'] || '' },
            { title:"PIC", data: d=> d['PIC'] || '' },
            { title:"Catatan", data: d=> d['Catatan'] || '' },
            { title:"Aksi", data: d=> d, orderable:false, render: row => {
                const uid = row.uid || '';
                return `<div class="d-flex gap-1">
                  <button class="btn btn-sm btn-secondary btn-view" data-uid="${escapeHtml(uid)}" title="Lihat"><i class="fa-solid fa-eye"></i></button>
                  <button class="btn btn-sm btn-primary btn-edit" data-uid="${escapeHtml(uid)}" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                  <button class="btn btn-sm btn-danger btn-del" data-uid="${escapeHtml(uid)}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                </div>`;
              } }
          ],
          pageLength: initialLength === -1 ? -1 : initialLength,
          lengthMenu: lengthMenu,
          responsive: true,
          autoWidth: false,
          destroy: true,
          dom: 'lfrtip'
        });

        $('#tblProjectsPM').on('draw.dt', function(){
          const currentLen = dt.page.len();
          pageLengthSelect.value = String(currentLen === -1 ? -1 : currentLen);
        });

        pageLengthSelect.addEventListener('change', function(){
          const val = Number(this.value);
          dt.page.len(val).draw(false);
        });

        $('#tblProjectsPM tbody').off('click').on('click', 'button.btn-view', function(){ openView(this.dataset.uid); });
        $('#tblProjectsPM tbody').on('click', 'button.btn-edit', function(){ openEdit(this.dataset.uid); });
        $('#tblProjectsPM tbody').on('click', 'button.btn-del', function(){ confirmDelete(this.dataset.uid); });

        const fp = document.getElementById('fallbackPagination');
        if (fp) fp.style.display = 'none';
      } catch (e) {
        console.warn('DataTables init failed, fallback to plain pagination', e);
        const fp = document.getElementById('fallbackPagination');
        if (fp) fp.style.display = '';
        fallbackPageSize = Number(pageLengthSelect.value);
        if (fallbackPageSize === -1) fallbackPageSize = -1;
        fallbackPage = 1;
        renderFallbackPage();
      }
    } else {
      const fp = document.getElementById('fallbackPagination');
      if (fp) fp.style.display = '';
      fallbackPageSize = Number(document.getElementById('pageLengthSelect').value);
      fallbackPage = Math.max(1, Math.min(fallbackPage, Math.max(1, Math.ceil((fallbackRows.length || 1) / (fallbackPageSize === -1 ? fallbackRows.length || 1 : fallbackPageSize)))));
      renderFallbackPage();

      document.getElementById('pageLengthSelect').addEventListener('change', function(){
        fallbackPageSize = Number(this.value);
        fallbackPage = 1;
        renderFallbackPage();
      });
    }
  }

  async function apiList() { return await fetchJSON(API_BASE); }
  async function apiCreate(payload) { return await fetchJSON(API_BASE, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); }
  async function apiUpdate(uid, payload) { return await fetchJSON(`${API_BASE}/${encodeURIComponent(uid)}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); }
  async function apiDelete(uid) { return await fetchJSON(`${API_BASE}/${encodeURIComponent(uid)}`, { method:'DELETE' }); }

  function insertRowInTable(newRow) {
    if (detectDataTables() && dt) {
      const info = dt.page.info();
      dt.row.add(newRow).draw(false);
      dt.page(info.page).draw(false);
    } else {
      fallbackRows.push(newRow);
      renderFallbackPage();
    }
  }

  function updateRowInTable(uid, updatedRow) {
    if (detectDataTables() && dt) {
      const rows = dt.rows().data().toArray();
      const idx = rows.findIndex(r => String(r.uid || '') === String(uid));
      if (idx !== -1) {
        dt.row(idx).data(updatedRow).draw(false);
      } else {
        dt.row.add(updatedRow).draw(false);
      }
    } else {
      const i = fallbackRows.findIndex(r => String(r.uid || '') === String(uid));
      if (i !== -1) fallbackRows[i] = updatedRow;
      else fallbackRows.push(updatedRow);
      renderFallbackPage();
    }
  }

  function removeRowFromTable(uid) {
    if (detectDataTables() && dt) {
      const rows = dt.rows().data().toArray();
      const idx = rows.findIndex(r => String(r.uid || '') === String(uid));
      if (idx !== -1) dt.row(idx).remove().draw(false);
    } else {
      const i = fallbackRows.findIndex(r => String(r.uid || '') === String(uid));
      if (i !== -1) fallbackRows.splice(i,1);
      const total = fallbackRows.length;
      const pageSize = (fallbackPageSize === -1) ? total || 1 : fallbackPageSize;
      const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
      if (fallbackPage > totalPages) fallbackPage = totalPages;
      renderFallbackPage();
    }
  }

  function openAdd() {
    const modalEl = document.getElementById('modalProject');
    if (!modalEl) return;
    const form = document.getElementById('formProject');
    form.reset();
    document.getElementById('fieldUid').value = '';
    document.getElementById('modalTitle').textContent = 'Tambah Project';
    document.getElementById('fieldSubmit').value = new Date().toISOString().slice(0,10);
    if (!modalInstance) modalInstance = new bootstrap.Modal(modalEl);
    modalInstance.show();
  }

  async function openEdit(uid) {
    try {
      const rows = await apiList();
      const row = (rows || []).find(r => String(r.uid || '') === String(uid));
      if (!row) { toast('Data tidak ditemukan', 'error'); return; }
      document.getElementById('fieldUid').value = row.uid || '';
      document.getElementById('fieldBrd').value = row['BRD No'] || '';
      document.getElementById('fieldProject').value = row['Project/Fitur'] || '';
      document.getElementById('fieldLink').value = row['Link BRD'] || '';
      document.getElementById('fieldPic').value = row['PIC'] || '';
      document.getElementById('fieldStatus').value = row['Status'] || 'New';
      document.getElementById('fieldPriority').value = row['Priority'] || 'Medium';
      document.getElementById('fieldSubmit').value = row['Tanggal Submit'] || '';
      document.getElementById('fieldCompleted').value = row['Tanggal Completed'] || '';
      document.getElementById('fieldNotes').value = row['Catatan'] || '';
      document.getElementById('modalTitle').textContent = 'Edit Project';
      if (!modalInstance) modalInstance = new bootstrap.Modal(document.getElementById('modalProject'));
      modalInstance.show();
    } catch (e) {
      console.error('openEdit error', e);
      toast('Gagal membuka data', 'error');
    }
  }

  // NEW: openView (readonly)
  async function openView(uid) {
    try {
      // get latest list and find item
      const rows = await apiList();
      const row = (rows || []).find(r => String(r.uid || '') === String(uid));
      if (!row) { toast('Data tidak ditemukan', 'error'); return; }

      document.getElementById('viewUid').value = row.uid || '';
      document.getElementById('viewBrd').value = row['BRD No'] || '';
      document.getElementById('viewProject').value = row['Project/Fitur'] || '';
      document.getElementById('viewLink').value = row['Link BRD'] || '';
      document.getElementById('viewPic').value = row['PIC'] || '';
      document.getElementById('viewStatus').value = row['Status'] || '';
      document.getElementById('viewPriority').value = row['Priority'] || '';
      document.getElementById('viewSubmit').value = row['Tanggal Submit'] || '';
      document.getElementById('viewCompleted').value = row['Tanggal Completed'] || '';
      document.getElementById('viewNotes').value = row['Catatan'] || '';

      const viewModal = new bootstrap.Modal(document.getElementById('modalViewProject'));
      viewModal.show();
    } catch (e) {
      console.error('openView error', e);
      toast('Gagal membuka view', 'error');
    }
  }

  async function saveProject(ev) {
    ev.preventDefault();
    try {
      const uid = document.getElementById('fieldUid').value;
      const payload = {
        "BRD No": document.getElementById('fieldBrd').value.trim(),
        "Project/Fitur": document.getElementById('fieldProject').value.trim(),
        "Link BRD": document.getElementById('fieldLink').value.trim(),
        "PIC": document.getElementById('fieldPic').value.trim(),
        "Status": document.getElementById('fieldStatus').value,
        "Priority": document.getElementById('fieldPriority').value,
        "Tanggal Submit": document.getElementById('fieldSubmit').value || '',
        "Tanggal Completed": document.getElementById('fieldCompleted').value || '',
        "Catatan": document.getElementById('fieldNotes').value || ''
      };

      if (!payload["BRD No"] || !payload["Project/Fitur"]) { toast('BRD No dan Project/Fitur wajib diisi', 'error'); return; }

      if (uid) {
        const updated = await apiUpdate(uid, payload);
        updateRowInTable(uid, updated || Object.assign({uid}, payload));
        if (window.Notifications) Notifications.push({ type:'info', title:'Project diperbarui', message: payload["BRD No"] || '' });
        toast('Perubahan tersimpan');
      } else {
        const created = await apiCreate(payload);
        insertRowInTable(created || payload);
        if (window.Notifications) Notifications.push({ type:'success', title:'Project ditambahkan', message: payload["BRD No"] || '' });
        toast('Project berhasil ditambahkan');
      }

      if (modalInstance) modalInstance.hide();
    } catch (e) {
      console.error('saveProject error', e);
      if (window.Notifications) Notifications.push({ type:'error', title:'Gagal menyimpan', message: e.message || '' });
      toast('Gagal menyimpan: ' + (e.message || e), 'error');
    }
  }

  async function confirmDelete(uid) {
    if (!confirm('Yakin ingin menghapus project ini?')) return;
    try {
      await apiDelete(uid);
      removeRowFromTable(uid);
      if (window.Notifications) Notifications.push({ type:'warning', title:'Project dihapus', message: uid });
      toast('Project dihapus');
    } catch (e) {
      console.error('confirmDelete error', e);
      if (window.Notifications) Notifications.push({ type:'error', title:'Gagal hapus', message: e.message || '' });
      toast('Gagal menghapus: ' + (e.message || e), 'error');
    }
  }

  function openImport(){
    const input = document.getElementById('importFileInput');
    if (!input) { toast('Input import tidak ditemukan', 'error'); return; }
    input.value = '';
    input.onchange = async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const mode = prompt('Mode import: append atau replace', 'append');
      if (!mode) return;
      const form = new FormData();
      form.append('file', file);
      form.append('mode', mode.toLowerCase() === 'replace' ? 'replace' : 'append');

      try {
        const res = await fetch(API_IMPORT, { method:'POST', body: form });
        const text = await res.text().catch(()=> '');
        let json = null; try { json = text ? JSON.parse(text) : null; } catch(e){}
        if (!res.ok) { const err = (json && json.error) ? json.error : `HTTP ${res.status}`; throw new Error(err); }
        if (window.Notifications) Notifications.push({ type:'success', title:'Import selesai', message: 'Data berhasil diimpor' });
        toast('Import berhasil');
        const rows = await apiList();
        initTable(rows || []);
      } catch (e) {
        console.error('import error', e);
        if (window.Notifications) Notifications.push({ type:'error', title:'Import gagal', message: e.message || '' });
        toast('Import gagal: ' + (e.message || e), 'error');
      }
    };
    input.click();
  }

  async function loadAll() {
    try {
      const [summary, rows] = await Promise.all([
        fetchJSON(API_SUMMARY).catch(()=> ({})),
        fetchJSON(API_BASE).catch(()=> [])
      ]);
      initTable(rows || []);
    } catch (e) {
      console.error('loadAll error', e);
      toast('Gagal memuat data: ' + (e.message || e), 'error');
    }
  }

  function setup() {
    const btnAdd = document.getElementById('btnOpenAddModal');
    if (btnAdd) btnAdd.addEventListener('click', openAdd);
    const btnImport = document.getElementById('btnOpenImportModal');
    if (btnImport) btnImport.addEventListener('click', openImport);
    const btnRefresh = document.getElementById('btnRefreshPM');
    if (btnRefresh) btnRefresh.addEventListener('click', async ()=> {
      const rows = await apiList();
      initTable(rows || []);
    });

    const form = document.getElementById('formProject');
    if (form) form.addEventListener('submit', saveProject);

    const btnGoBack = document.getElementById('btnGoBack');
    if (btnGoBack) btnGoBack.addEventListener('click', function(){
      if (document.referrer && document.referrer !== window.location.href) {
        window.history.back();
      } else {
        window.location.href = '/dashboard';
      }
    });

    const search = document.getElementById('searchInputPM');
    if (search) {
      search.addEventListener('input', function () {
        if (detectDataTables() && dt) {
          dt.search(this.value).draw(false);
        } else {
          const q = this.value.trim().toLowerCase();
          document.querySelectorAll('#tblProjectsPM tbody tr').forEach(tr => {
            tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
        }
      });
    }

    const clear = document.getElementById('btnClearSearchPM');
    if (clear) clear.addEventListener('click', function () {
      const s = document.getElementById('searchInputPM');
      if (s) s.value = '';
      const pageLengthSelect = document.getElementById('pageLengthSelect');
      if (pageLengthSelect) {
        pageLengthSelect.value = '-1';
        if (detectDataTables() && dt) {
          dt.search('').page.len(-1).draw(false);
        } else {
          fallbackPageSize = -1;
          fallbackPage = 1;
          renderFallbackPage();
        }
      } else {
        if (detectDataTables() && dt) dt.search('').draw(false);
        else document.querySelectorAll('#tblProjectsPM tbody tr').forEach(tr => tr.style.display = '');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    setup();
    loadAll();
  });

})();
