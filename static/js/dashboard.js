// static/js/dashboard.js
// Fetch dashboard summary and render charts and recent list.
// Priority chart now uses fixed order: Low, Medium, High, Urgent (only these four).

(async function(){
  'use strict';

  const api = '/api/dashboard/summary';

  function qs(s){ return document.querySelector(s); }
  function el(tag, cls){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }

  function formatNumber(n){ return (n === undefined || n === null) ? '0' : String(n); }

  async function fetchSummary(){
    try {
      const r = await fetch(api);
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch(err){
      console.error(err);
      return null;
    }
  }

  function buildMonthlyChart(ctx, labels, data){
    return new Chart(ctx, {
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
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } }
        }
      }
    });
  }

  function buildDonutChart(ctx, labels, data, colors){
    const total = data.reduce((s,v)=>s+Number(v||0),0);
    if(total === 0){
      return null;
    }
    return new Chart(ctx, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  function topPriorityFromCounts(counts){
    const entries = Object.entries(counts || {});
    if(entries.length === 0) return '-';
    entries.sort((a,b)=> b[1]-a[1]);
    return entries[0][0] || '-';
  }

  function renderRecentList(dfRecords){
    const container = qs('#recentList');
    container.innerHTML = '';
    if(!dfRecords || dfRecords.length === 0){
      container.innerHTML = '<div class="text-muted">Tidak ada project</div>';
      return;
    }
    const items = dfRecords.slice(-8).reverse();
    items.forEach(r=>{
      const a = el('a','list-group-item list-group-item-action d-flex justify-content-between align-items-start');
      a.href = '#';
      a.innerHTML = `<div>
        <div style="font-weight:600">${r['Project/Fitur'] || r['project'] || '-'}</div>
        <div class="meta" style="font-size:12px;color:#6b7280">${r['BRD No'] || r['brd_no'] || ''} • ${r['PIC'] || r['pic'] || ''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700">${r['Status'] || r['status'] || ''}</div>
        <div style="font-size:12px;color:#6b7280">${r['Tanggal Submit'] || r['tanggal_submit'] || ''}</div>
      </div>`;
      container.appendChild(a);
    });
  }

  function showNoDataMessage(containerSelector, message){
    const c = qs(containerSelector);
    if(!c) return;
    c.innerHTML = `<div style="padding:18px;color:#6b7280;text-align:center">${message}</div>`;
  }

  async function init(){
    const s = await fetchSummary();
    if(!s) return;
    qs('#kpiTotal').textContent = formatNumber(s.total);
    qs('#kpiCompleted').textContent = formatNumber(s.completed);
    qs('#kpiTopPriority').textContent = topPriorityFromCounts(s.priority_counts);

    // ---------- Status Distribution (canonical order) ----------
    const canonical = ["New","In Progress","Pending","Completed"];
    const statusCounts = s.status_counts || {};
    const statusLabels = canonical;
    const statusData = statusLabels.map(k => statusCounts[k] || 0);
    const statusColors = ['#0ea5e9','#f59e0b','#f97316','#10b981'];
    const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    try { if(window._chartStatus) window._chartStatus.destroy(); } catch(e){}
    window._chartStatus = buildDonutChart(ctxStatus, statusLabels, statusData, statusColors);
    if(!window._chartStatus){
      showNoDataMessage('#chartStatus', 'Tidak ada data status');
    }

    // ---------- Priority Distribution (fixed canonical order Low, Medium, High, Urgent) ----------
    const canonicalPriorities = ["Low","Medium","High","Urgent"];
    const rawPriorityCounts = s.priority_counts || {};
    const prLabels = canonicalPriorities;
    const prData = prLabels.map(k => Number(rawPriorityCounts[k] || 0));
    const prColors = ['#60a5fa','#f59e0b','#f97316','#ef4444']; // Low, Medium, High, Urgent
    const ctxPr = document.getElementById('chartPriority').getContext('2d');
    try { if(window._chartPriority) window._chartPriority.destroy(); } catch(e){}
    window._chartPriority = buildDonutChart(ctxPr, prLabels, prData, prColors);
    if(!window._chartPriority){
      showNoDataMessage('#chartPriority', 'Tidak ada data priority');
    }

    // ---------- Monthly chart ----------
    const perMonth = s.per_month || {};
    const labels = Object.keys(perMonth).sort();
    const data = labels.map(k => perMonth[k] || 0);
    const ctxMonthly = document.getElementById('chartMonthly').getContext('2d');
    try { if(window._chartMonthly) window._chartMonthly.destroy(); } catch(e){}
    window._chartMonthly = buildMonthlyChart(ctxMonthly, labels, data);

    // recent list
    try {
      const r = await fetch('/api/projects');
      if(r.ok){
        const rec = await r.json();
        renderRecentList(rec);
        const now = new Date();
        const cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const monthCount = (s.per_month && s.per_month[cur]) ? s.per_month[cur] : 0;
        qs('#kpiMonth').textContent = formatNumber(monthCount);
      }
    } catch(e){ console.error(e); }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
