// Admin Panel logic: KPI, charts, table, CRUD, import, export
(function(){
  'use strict';

  const API_PROJECTS = '/api/projects';
  const API_SUMMARY = '/api/dashboard/summary';

  let dt = null;
  let addModal, editModal, importModal;

  function qs(s){ return document.querySelector(s); }
  function toast(msg, type='success'){
    const t=document.createElement('div');
    t.textContent=msg;
    t.className='toast-lite';
    t.style.position='fixed'; t.style.right='18px'; t.style.bottom='18px';
    t.style.background = type==='error' ? '#ef4444' : '#10b981';
    t.style.color='#fff'; t.style.padding='10px 14px'; t.style.borderRadius='8px'; t.style.zIndex=99999;
    document.body.appendChild(t); setTimeout(()=>t.remove(),3000);
  }
  function escapeHtml(s){ if(s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  function canonicalStatus(v){
    if(!v) return 'New';
    const s = String(v).trim().toLowerCase();
    if(s==='new') return 'New';
    if(s==='in progress' || s==='inprogress' || s==='on progress' || s.includes('progress')) return 'In Progress';
    if(s==='pending' || s.includes('pending')) return 'Pending';
    if(s==='completed' || s.includes('complete') || s.includes('done')) return 'Completed';
    return 'New';
  }

  function statusBadge(val){
    const s = (val||'').toString().toLowerCase();
    const cls = s.includes('completed') ? 'badge-status-completed' :
                (s.includes('in progress') || s.includes('progress')) ? 'badge-status-inprogress' :
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

  async function fetchJSON(url, opts){
    const r = await fetch(url, opts);
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }

  function initDataTable(rows){
    if(dt){
      dt.clear(); dt.rows.add(rows); dt.draw(false); return;
    }
    dt = $('#tblProjects').DataTable({
      data: rows,
      columns: [
        { title: "No", data: null, render: (d,t,r,meta)=> meta.row+1, width:'56px' },
        { title: "BRD No", data: d=> d['BRD No'] || '' },
        { title: "Project / Fitur", data: d=> d['Project/Fitur'] || '' },
        { title: "Link BRD", data: d=> {
            const link = d['Link BRD'] || '';
            if(!link) return '';
            return `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a>`;
          }, orderable:false },
        { title: "Status", data: d=> d['Status'] || '', render: (data)=> statusBadge(data) },
        { title: "Priority", data: d=> d['Priority'] || '', render: (data)=> priorityBadge(data) },
        { title: "Tanggal Submit", data: d=> d['Tanggal Submit'] || '' },
        { title: "Tanggal Completed", data: d=> d['Tanggal Completed'] || '' },
        { title: "PIC", data: d=> d['PIC'] || '' },
        { title: "Catatan", data: d=> d['Catatan'] || '' },
        { title: "Aksi", data: d=> d, orderable:false, render: (row)=> {
            const uid = row.uid || '';
            return `<div class="d-flex gap-1">
              <button class="btn btn-sm btn-primary btn-edit" data-uid="${escapeHtml(uid)}"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn btn-sm btn-danger btn-del" data-uid="${escapeHtml(uid)}"><i class="fa-solid fa-trash"></i></button>
            </div>`;
          } }
      ],
      createdRow: function(row, data){ row.dataset.uid = data.uid || ''; },
      pageLength: 10,
      responsive: true,
      autoWidth: false,
      destroy: true
    });

    // search binding
    const searchInput = qs('#searchInput');
    const clearBtn = qs('#btnClearSearch');
    searchInput.addEventListener('input', ()=> dt.search(searchInput.value).draw());
    clearBtn.addEventListener('click', ()=> { searchInput.value=''; dt.search('').draw(); });
  }

  async function refreshAll(){
    try {
      const [summary, rows] = await Promise.all([
        fetchJSON(API_SUMMARY),
        fetchJSON(API_PROJECTS)
      ]);
      // KPI
      qs('#kpiTotal').textContent = String(summary.total || 0);
      qs('#kpiCompleted').textContent = String(summary.completed || 0);
      const now = new Date();
      const cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      qs('#kpiMonth').textContent = String((summary.per_month && summary.per_month[cur]) ? summary.per_month[cur] : 0);
      // top priority
      const pc = summary.priority_counts || {};
      const order = ['Low','Medium','High','Urgent'];
      let top = '-'; let max = -1;
      order.forEach(k=> { const v = Number(pc[k]||0); if(v>max){ max=v; top=k; } });
      qs('#kpiTopPriority').textContent = top;

      // Charts
      renderCharts(summary);

      // Table
      initDataTable(rows);

      // Recent list
      renderRecent(rows);
    } catch(err){
      console.error(err);
      toast('Gagal memuat data', 'error');
    }
  }

  function renderCharts(summary){
    // Status chart
    const statusLabels = ["New","In Progress","Pending","Completed"];
    const statusData = statusLabels.map(k => Number((summary.status_counts||{})[k]||0));
    const statusColors = ['#0ea5e9','#f59e0b','#f97316','#10b981'];
    const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    if(window._chartStatus) try{ window._chartStatus.destroy(); }catch(e){}
    window._chartStatus = new Chart(ctxStatus, {
      type: 'doughnut',
      data: { labels: statusLabels, datasets: [{ data: statusData, backgroundColor: statusColors }] },
      options: { responsive:true, plugins:{ legend:{ position:'bottom' } } }
    });

    // Priority chart (fixed order)
    const prLabels = ["Low","Medium","High","Urgent"];
    const prData = prLabels.map(k => Number((summary.priority_counts||{})[k]||0));
    const prColors = ['#60a5fa','#f59e0b','#f97316','#ef4444'];
    const ctxPr = document.getElementById('chartPriority').getContext('2d');
    if(window._chartPriority) try{ window._chartPriority.destroy(); }catch(e){}
    const totalPr = prData.reduce((s,v)=> s+v, 0);
    if(totalPr === 0){
      // show friendly message
      const canvas = document.getElementById('chartPriority');
      const parent = canvas.parentElement;
      parent.innerHTML = '<div class="text-center text-muted" style="padding:18px">Tidak ada data priority</div>';
      window._chartPriority = null;
    } else {
      // ensure canvas exists (in case replaced)
      const parent = document.getElementById('chartPriority').parentElement;
      parent.innerHTML = '<canvas id="chartPriority" height="140"></canvas>';
      const ctxPr2 = document.getElementById('chartPriority').getContext('2d');
      window._chartPriority = new Chart(ctxPr2, {
        type: 'doughnut',
        data: { labels: prLabels, datasets: [{ data: prData, backgroundColor: prColors }] },
        options: { responsive:true, plugins:{ legend:{ position:'bottom' } } }
      });
    }

    // Monthly chart
    const perMonth = summary.per_month || {};
    const labels = Object.keys(perMonth).sort();
    const data = labels.map(k => Number(perMonth[k]||0));
    const ctxMonthly = document.getElementById('chartMonthly').getContext('2d');
    if(window._chartMonthly) try{ window._chartMonthly.destroy(); }catch(e){}
    window._chartMonthly = new Chart(ctxMonthly, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Projects',
          data: data,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.08)',
          fill: true,
          tension: 0.25,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display:false } }, y: { beginAtZero:true, grid:{ color:'#f1f5f9' } } }
      }
    });
  }

  function renderRecent(rows){
    const container = qs('#recentList');
    container.innerHTML = '';
    if(!rows || rows.length===0){
      container.innerHTML = '<div class="text-muted">Tidak ada project</div>';
      return;
    }
    const items = rows.slice(-8).reverse();
    items.forEach(r=>{
      const a = document.createElement('a');
      a.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-start';
      a.href = '#';
      a.innerHTML = `<div>
        <div style="font-weight:600">${escapeHtml(r['Project/Fitur']||'-')}</div>
        <div class="meta" style="font-size:12px;color:#6b7280">${escapeHtml(r['BRD No']||'')} • ${escapeHtml(r['PIC']||'')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700">${escapeHtml(r['Status']||'')}</div>
        <div style="font-size:12px;color:#6b7280">${escapeHtml(r['Tanggal Submit']||'')}</div>
      </div>`;
      container.appendChild(a);
    });
  }

  // CRUD handlers
  async function createProject(form){
    const fd = new FormData(form);
    const payload = {
      'BRD No': fd.get('brd_no') || '',
      'Project/Fitur': fd.get('project') || '',
      'Link BRD': fd.get('link_brd') || '',
      'PIC': fd.get('pic') || '',
      'Contact Person': fd.get('contact_person') || '',
      'Status': canonicalStatus(fd.get('status') || ''),
      'Priority': fd.get('priority') || 'Medium',
      'Tanggal Submit': fd.get('tanggal_submit') || '',
      'Tanggal Completed': fd.get('tanggal_completed') || '',
      'Catatan': fd.get('catatan') || ''
    };
    try {
      const r = await fetch(API_PROJECTS, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(!r.ok) throw new Error('HTTP ' + r.status);
      toast('Project ditambahkan');
      form.reset();
      refreshAll();
      addModal.hide();
    } catch(err){ console.error(err); toast('Gagal menambah project','error'); }
  }

  async function updateProject(form){
    const fd = new FormData(form);
    const uid = fd.get('uid');
    const payload = {
      'BRD No': fd.get('brd_no') || '',
      'Project/Fitur': fd.get('project') || '',
      'Link BRD': fd.get('link_brd') || '',
      'PIC': fd.get('pic') || '',
      'Contact Person': fd.get('contact_person') || '',
      'Status': canonicalStatus(fd.get('status') || ''),
      'Priority': fd.get('priority') || 'Medium',
      'Tanggal Submit': fd.get('tanggal_submit') || '',
      'Tanggal Completed': fd.get('tanggal_completed') || '',
      'Catatan': fd.get('catatan') || ''
    };
    try {
      const r = await fetch(API_PROJECTS + '/' + encodeURIComponent(uid), { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(!r.ok) throw new Error('HTTP ' + r.status);
      toast('Perubahan tersimpan');
      refreshAll();
      editModal.hide();
    } catch(err){ console.error(err); toast('Gagal menyimpan perubahan','error'); }
  }

  async function deleteProject(uid){
    if(!confirm('Hapus project ini?')) return;
    try {
      const r = await fetch(API_PROJECTS + '/' + encodeURIComponent(uid), { method:'DELETE' });
      if(!r.ok) throw new Error('HTTP ' + r.status);
      toast('Project dihapus');
      refreshAll();
    } catch(err){ console.error(err); toast('Gagal menghapus','error'); }
  }

  // Import
  async function importExcel(form){
    const statusEl = qs('#importStatus');
    statusEl.textContent = 'Mengunggah...';
    const fd = new FormData(form);
    try {
      const r = await fetch(API_PROJECTS + '/import', { method:'POST', body: fd });
      const json = await r.json().catch(()=>null);
      if(!r.ok){
        statusEl.textContent = 'Import gagal: ' + (json && json.error ? json.error : r.status);
        toast('Import gagal','error');
        return;
      }
      statusEl.textContent = 'Import berhasil: ' + (json.imported || 0) + ' baris';
      toast('Import berhasil');
      setTimeout(()=> { importModal.hide(); refreshAll(); }, 800);
    } catch(err){
      console.error(err);
      statusEl.textContent = 'Import gagal: ' + (err.message || err);
      toast('Import gagal','error');
    }
  }

  function bindUI(){
    // Bootstrap modals
    addModal = new bootstrap.Modal(document.getElementById('modalAddProject'));
    editModal = new bootstrap.Modal(document.getElementById('modalEditProject'));
    importModal = new bootstrap.Modal(document.getElementById('modalImport'));

    // Header buttons
    qs('#btnOpenAddModal').addEventListener('click', ()=> addModal.show());
    qs('#btnOpenImportModal').addEventListener('click', ()=> importModal.show());

    // Sidebar quick actions
    qs('#menu-import').addEventListener('click', (e)=> { e.preventDefault(); importModal.show(); });
    qs('#menu-export-excel').addEventListener('click', (e)=> { e.preventDefault(); window.location = '/api/projects/export/excel'; });
    qs('#menu-export-pdf').addEventListener('click', async (e)=> {
      e.preventDefault();
      try {
        const r = await fetch('/api/projects/export/pdf');
        if(r.ok){
          const b = await r.blob();
          const url = URL.createObjectURL(b);
          const a = document.createElement('a');
          a.href = url; a.download = 'projects.pdf'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        } else {
          window.open('/api/projects/export/pdf-fallback', '_blank');
        }
      } catch(err){ window.open('/api/projects/export/pdf-fallback', '_blank'); }
    });

    // Form submit
    qs('#formAddProject').addEventListener('submit', function(e){ e.preventDefault(); createProject(this); });
    qs('#formEditProject').addEventListener('submit', function(e){ e.preventDefault(); updateProject(this); });
    qs('#formImport').addEventListener('submit', function(e){ e.preventDefault(); importExcel(this); });

    // Table row actions
    document.addEventListener('click', function(e){
      const editBtn = e.target.closest('.btn-edit');
      if(editBtn){
        const uid = editBtn.dataset.uid;
        const row = dt ? dt.rows().data().toArray().find(r => String(r.uid)===String(uid)) : null;
        if(!row) return;
        const f = qs('#formEditProject');
        f.querySelector('[name="uid"]').value = row.uid || '';
        f.querySelector('[name="brd_no"]').value = row['BRD No'] || '';
        f.querySelector('[name="project"]').value = row['Project/Fitur'] || '';
        f.querySelector('[name="link_brd"]').value = row['Link BRD'] || '';
        f.querySelector('[name="pic"]').value = row['PIC'] || '';
        f.querySelector('[name="contact_person"]').value = row['Contact Person'] || '';
        f.querySelector('[name="status"]').value = row['Status'] || 'New';
        f.querySelector('[name="priority"]').value = row['Priority'] || 'Medium';
        f.querySelector('[name="tanggal_submit"]').value = row['Tanggal Submit'] || '';
        f.querySelector('[name="tanggal_completed"]').value = row['Tanggal Completed'] || '';
        f.querySelector('[name="catatan"]').value = row['Catatan'] || '';
        editModal.show();
        return;
      }
      const delBtn = e.target.closest('.btn-del');
      if(delBtn){
        const uid = delBtn.dataset.uid;
        deleteProject(uid);
        return;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    bindUI();
    refreshAll();
  });

})();
