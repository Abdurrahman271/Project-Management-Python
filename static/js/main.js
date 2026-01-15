// static/js/main.js
// Frontend logic: CRUD, DataTable, Export, Import (append/replace).
// Ensures status values sent to server are canonical: New, In Progress, Pending, Completed

(function(){
  'use strict';

  const API_BASE = '/api/projects';
  let dtInstance = null;
  window.clientData = [];

  function qs(s){ return document.querySelector(s); }
  function escapeHtml(s){ if(s === null || s === undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function toast(msg, type='success'){ const t=document.createElement('div'); t.textContent=msg; t.style.position='fixed'; t.style.right='18px'; t.style.bottom='18px'; t.style.background = type==='error' ? '#ef4444' : '#10b981'; t.style.color='#fff'; t.style.padding='10px 14px'; t.style.borderRadius='8px'; t.style.zIndex=99999; document.body.appendChild(t); setTimeout(()=>t.remove(),3000); }

  // map UI selection to canonical status
  function canonicalStatusFromInput(v){
    if(!v) return 'New';
    const s = String(v).trim().toLowerCase();
    if(s === 'new') return 'New';
    if(s === 'in progress' || s === 'inprogress' || s === 'on progress' || s === 'progress') return 'In Progress';
    if(s === 'pending') return 'Pending';
    if(s === 'completed' || s === 'done') return 'Completed';
    // fallback: try to match keywords
    if(s.includes('new')) return 'New';
    if(s.includes('in progress') || s.includes('progress') || s.includes('inprogress')) return 'In Progress';
    if(s.includes('pending')) return 'Pending';
    if(s.includes('complete') || s.includes('done')) return 'Completed';
    return 'New';
  }

  async function fetchWithTimeout(url, opts={}, timeout=20000){
    const controller = new AbortController();
    const id = setTimeout(()=> controller.abort(), timeout);
    try {
      const res = await fetch(url, Object.assign({}, opts, { signal: controller.signal }));
      clearTimeout(id);
      return res;
    } catch(e){ clearTimeout(id); throw e; }
  }

  function actionsHtml(uid){
    return `<div class="d-flex gap-1">
      <button class="btn btn-sm btn-primary btn-edit" data-uid="${escapeHtml(uid)}"><i class="fa-solid fa-pen-to-square"></i></button>
      <button class="btn btn-sm btn-danger btn-del" data-uid="${escapeHtml(uid)}"><i class="fa-solid fa-trash"></i></button>
    </div>`;
  }

  function renderStatusBadge(val){
    const s = (val || '').toString();
    const cls = (s.toLowerCase().includes('completed')) ? 'badge-status-completed' :
                (s.toLowerCase().includes('in progress') || s.toLowerCase().includes('progress')) ? 'badge-status-inprogress' :
                (s.toLowerCase().includes('pending')) ? 'badge-status-pending' :
                'badge-status-new';
    return `<span class="badge-cell ${cls}">${escapeHtml(s)}</span>`;
  }

  function renderPriorityBadge(val){
    const p = (val || '').toString();
    const cls = (p.toLowerCase().includes('urgent')) ? 'badge-priority-urgent' :
                (p.toLowerCase().includes('high')) ? 'badge-priority-high' :
                (p.toLowerCase().includes('medium')) ? 'badge-priority-medium' :
                (p.toLowerCase().includes('low')) ? 'badge-priority-low' :
                'badge-priority-default';
    return `<span class="badge-cell ${cls}">${escapeHtml(p)}</span>`;
  }

  function initOrUpdateTable(data){
    window.clientData = Array.isArray(data) ? data : [];
    if(window.jQuery && $.fn && $.fn.DataTable){
      const $tbl = $('#tblProjects');
      if(dtInstance){
        try {
          dtInstance.clear();
          dtInstance.rows.add(window.clientData);
          dtInstance.draw(false);
          return;
        } catch(e){
          try { dtInstance.destroy(true); } catch(e){}
          dtInstance = null;
        }
      }
      dtInstance = $tbl.DataTable({
        data: window.clientData,
        columns: [
          { title: "No", data: null, render: (d,t,r,meta) => meta.row + 1, width: '56px' },
          { title: "BRD No", data: d => d['BRD No'] || d['brd_no'] || '' },
          { title: "Project / Fitur", data: d => d['Project/Fitur'] || d['project'] || '' },
          { title: "Link BRD", data: d => {
              const link = d['Link BRD'] || d['link_brd'] || '';
              if(!link) return '';
              return `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a>`;
            }, orderable:false },
          { title: "Status", data: d => d['Status'] || d['status'] || '', render: function(data){ return renderStatusBadge(data); } },
          { title: "Priority", data: d => d['Priority'] || d['priority'] || '', render: function(data){ return renderPriorityBadge(data); } },
          { title: "Tanggal Submit", data: d => d['Tanggal Submit'] || d['tanggal_submit'] || '' },
          { title: "Tanggal Completed", data: d => d['Tanggal Completed'] || d['tanggal_completed'] || '' },
          { title: "PIC", data: d => d['PIC'] || d['pic'] || '' },
          { title: "Catatan", data: d => d['Catatan'] || d['catatan'] || '' },
          { title: "Aksi", data: null, orderable:false, render: d => actionsHtml(d.uid || '') }
        ],
        createdRow: function(row, data){ row.dataset.uid = data.uid || ''; },
        pageLength: 10,
        responsive: true,
        autoWidth: false,
        destroy: true
      });
      return;
    }
    const tbody = qs('#tblProjectsBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    if(!data || !data.length){ tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">Belum ada project</td></tr>'; return; }
    data.forEach((r,i)=>{
      const tr = document.createElement('tr');
      tr.dataset.uid = r.uid || '';
      const link = r['Link BRD'] || r['link_brd'] || '';
      tr.innerHTML = `<td>${i+1}</td>
        <td>${escapeHtml(r['BRD No']||r['brd_no']||'')}</td>
        <td>${escapeHtml(r['Project/Fitur']||r['project']||'')}</td>
        <td>${link ? `<a href="${escapeHtml(link)}" target="_blank">${escapeHtml(link)}</a>` : ''}</td>
        <td>${renderStatusBadge(r['Status']||r['status']||'')}</td>
        <td>${renderPriorityBadge(r['Priority']||r['priority']||'')}</td>
        <td>${escapeHtml(r['Tanggal Submit']||r['tanggal_submit']||'')}</td>
        <td>${escapeHtml(r['Tanggal Completed']||r['tanggal_completed']||'')}</td>
        <td>${escapeHtml(r['PIC']||r['pic']||'')}</td>
        <td>${escapeHtml(r['Catatan']||r['catatan']||'')}</td>
        <td>${actionsHtml(r.uid||'')}</td>`;
      tbody.appendChild(tr);
    });
  }

  async function refreshProjectList(){
    try {
      const resp = await fetchWithTimeout(API_BASE, {}, 15000);
      if(!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      initOrUpdateTable(json);
      window.clientData = json;
      return json;
    } catch(err){
      console.error(err);
      toast('Gagal memuat data', 'error');
      return [];
    }
  }

  async function createProject(form){
    const btn = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);
    const payload = {
      'BRD No': fd.get('brd_no') || '',
      'Project/Fitur': fd.get('project') || '',
      'Link BRD': fd.get('link_brd') || '',
      'PIC': fd.get('pic') || '',
      'Contact Person': fd.get('contact_person') || '',
      'Status': canonicalStatusFromInput(fd.get('status') || ''),
      'Priority': fd.get('priority') || 'Medium',
      'Tanggal Submit': fd.get('tanggal_submit') || '',
      'Tanggal Completed': fd.get('tanggal_completed') || '',
      'Catatan': fd.get('catatan') || ''
    };
    try {
      btn && (btn.disabled = true);
      const resp = await fetchWithTimeout(API_BASE, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }, 15000);
      if(!resp.ok){
        const txt = await resp.text().catch(()=>null);
        throw new Error('HTTP ' + resp.status + (txt ? ' - ' + txt : ''));
      }
      await refreshProjectList();
      form.reset();
      document.getElementById('modalAddProject').style.display='none';
      toast('Project ditambahkan');
    } catch(err){
      console.error(err);
      toast('Gagal menambah project', 'error');
    } finally { btn && (btn.disabled = false); }
  }

  async function updateProject(uid, payload, btn){
    // ensure status normalized before sending
    if(payload && payload.Status) payload.Status = canonicalStatusFromInput(payload.Status);
    try {
      btn && (btn.disabled = true);
      const resp = await fetchWithTimeout(API_BASE + '/' + encodeURIComponent(uid), { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }, 15000);
      if(!resp.ok){
        const txt = await resp.text().catch(()=>null);
        throw new Error('HTTP ' + resp.status + (txt ? ' - ' + txt : ''));
      }
      await refreshProjectList();
      toast('Perubahan tersimpan');
    } catch(err){
      console.error(err);
      toast('Gagal menyimpan perubahan', 'error');
    } finally { btn && (btn.disabled = false); }
  }

  async function deleteProject(uid){
    if(!confirm('Hapus project ini?')) return;
    try {
      const resp = await fetchWithTimeout(API_BASE + '/' + encodeURIComponent(uid), { method:'DELETE' }, 10000);
      if(!resp.ok) throw new Error('HTTP ' + resp.status);
      await refreshProjectList();
      toast('Project dihapus');
    } catch(err){
      console.error(err);
      toast('Gagal menghapus', 'error');
    }
  }

  function bindUI(){
    qs('#btnOpenAddModal').addEventListener('click', ()=> {
      document.getElementById('modalAddProject').style.display='flex';
    });

    qs('#formAddProject').addEventListener('submit', function(e){
      e.preventDefault(); createProject(this);
    });

    qs('#formEditProject').addEventListener('submit', function(e){
      e.preventDefault();
      const uid = this.querySelector('[name="uid"]').value;
      const payload = {
        'BRD No': this.querySelector('[name="brd_no"]').value,
        'Project/Fitur': this.querySelector('[name="project"]').value,
        'Link BRD': this.querySelector('[name="link_brd"]').value,
        'PIC': this.querySelector('[name="pic"]').value,
        'Contact Person': this.querySelector('[name="contact_person"]').value,
        'Status': canonicalStatusFromInput(this.querySelector('[name="status"]').value),
        'Priority': this.querySelector('[name="priority"]').value,
        'Tanggal Submit': this.querySelector('[name="tanggal_submit"]').value,
        'Tanggal Completed': this.querySelector('[name="tanggal_completed"]').value,
        'Catatan': this.querySelector('[name="catatan"]').value
      };
      const btn = this.querySelector('button[type="submit"]');
      updateProject(uid, payload, btn).then(()=> { document.getElementById('modalEditProject').style.display='none'; });
    });

    document.addEventListener('click', function(e){
      const edit = e.target.closest('.btn-edit');
      if(edit){
        const uid = edit.dataset.uid || edit.closest('tr')?.dataset.uid;
        if(!uid) return;
        const row = (window.clientData || []).find(r => String(r.uid) === String(uid));
        if(row){
          const form = qs('#formEditProject');
          form.querySelector('[name="uid"]').value = row.uid || '';
          form.querySelector('[name="brd_no"]').value = row['BRD No'] || '';
          form.querySelector('[name="project"]').value = row['Project/Fitur'] || '';
          form.querySelector('[name="link_brd"]').value = row['Link BRD'] || '';
          form.querySelector('[name="pic"]').value = row['PIC'] || '';
          form.querySelector('[name="contact_person"]').value = row['Contact Person'] || '';
          form.querySelector('[name="status"]').value = row['Status'] || '';
          form.querySelector('[name="priority"]').value = row['Priority'] || '';
          form.querySelector('[name="tanggal_submit"]').value = row['Tanggal Submit'] || '';
          form.querySelector('[name="tanggal_completed"]').value = row['Tanggal Completed'] || '';
          form.querySelector('[name="catatan"]').value = row['Catatan'] || '';
          document.getElementById('modalEditProject').style.display='flex';
        }
        return;
      }

      const del = e.target.closest('.btn-del');
      if(del){
        const uid = del.dataset.uid || del.closest('tr')?.dataset.uid;
        if(!uid) return;
        deleteProject(uid);
        return;
      }
    });

    // Import submit
    qs('#formImport').addEventListener('submit', async function(e){
      e.preventDefault();
      const statusEl = qs('#importStatus');
      statusEl.textContent = 'Mengunggah...';
      const form = new FormData(this);
      try {
        const resp = await fetchWithTimeout(API_BASE + '/import', { method: 'POST', body: form }, 60000);
        const json = await resp.json().catch(()=>null);
        if(!resp.ok){
          statusEl.textContent = 'Import gagal: ' + (json && json.error ? json.error : resp.status);
          toast('Import gagal', 'error');
          return;
        }
        statusEl.textContent = 'Import berhasil: ' + (json.imported || 0) + ' baris';
        toast('Import berhasil', 'success');
        setTimeout(()=> { document.getElementById('modalImport').style.display='none'; refreshProjectList(); }, 800);
      } catch(err){
        console.error(err);
        statusEl.textContent = 'Import gagal: ' + (err.message || err);
        toast('Import gagal', 'error');
      }
    });

    qs('#btnExportExcel').addEventListener('click', function(){
      window.location = '/api/projects/export/excel';
    });
    qs('#btnExportPDF').addEventListener('click', function(){
      fetch('/api/projects/export/pdf').then(r => {
        if(r.ok) return r.blob().then(b => {
          const url = URL.createObjectURL(b);
          const a = document.createElement('a');
          a.href = url; a.download = 'projects.pdf'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        });
        window.open('/api/projects/export/pdf-fallback', '_blank');
      }).catch(()=> window.open('/api/projects/export/pdf-fallback', '_blank'));
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    bindUI();
    refreshProjectList();
  });

})();


async function loadAll(){
  try {
    showLoading(); //⬅️ Tambahkan ini
    const [summary, rows] = await Promise.all([
      fetchJSON(API_SUMMARY).catch(()=> ({})),
      fetchJSON(API_BASE).catch(()=> [])
    ]);
    initTable(rows || []);
  } catch (e) {
    console.error('loadAll error', e);
    toast('Gagal memuat data: ' + (e.message || e), 'error');
  } finally {
    hideLoading(); //⬅️ Tambahkan ini
  }
}



