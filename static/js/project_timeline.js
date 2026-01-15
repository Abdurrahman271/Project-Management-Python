// Project Timeline (Yearly) — build bars per project across Jan–Dec
(function(){
  'use strict';

  const API = '/api/projects';

  function qs(s){ return document.querySelector(s); }
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

  function priorityClass(v){
    const p = (v||'').toString().toLowerCase();
    if(p.includes('urgent')) return 'urgent';
    if(p.includes('high')) return 'high';
    if(p.includes('medium')) return 'medium';
    if(p.includes('low')) return 'low';
    return 'default';
  }

  function monthIndex(dateStr){
    // returns 0..11 for Jan..Dec, or null if invalid
    if(!dateStr) return null;
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return null;
    return d.getMonth();
  }

  function yearOf(dateStr){
    if(!dateStr) return null;
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return null;
    return d.getFullYear();
  }

  function buildRow(record, year){
    const container = document.createElement('div');
    container.className = 'grid-row';

    // title col
    const titleCol = document.createElement('div');
    titleCol.className = 'grid-col grid-col-title';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'row-title';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = record['Project/Fitur'] || '-';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const brd = record['BRD No'] || '';
    const pic = record['PIC'] || '';
    meta.textContent = `${brd} • ${pic}`;
    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);
    titleCol.appendChild(titleWrap);
    container.appendChild(titleCol);

    // 12 month cells
    const startMonth = monthIndex(record['Tanggal Submit']);
    const endMonth = monthIndex(record['Tanggal Completed']);
    const startYear = yearOf(record['Tanggal Submit']);
    const endYear = yearOf(record['Tanggal Completed']);
    const status = canonicalStatus(record['Status']);
    const pClass = priorityClass(record['Priority']);

    // fallback: if no end date, assume +1 month from start
    let sIdx = (startYear === year && startMonth !== null) ? startMonth : null;
    let eIdx = (endYear === year && endMonth !== null) ? endMonth : null;

    // if dates cross year, clamp to current year
    if(sIdx === null && startMonth !== null && startYear !== null){
      // if start year < current year, start at Jan
      if(startYear < year) sIdx = 0;
      if(startYear > year) sIdx = null;
    }
    if(eIdx === null && endMonth !== null && endYear !== null){
      if(endYear > year) eIdx = 11;
      if(endYear < year) eIdx = null;
    }

    // if both null but have startMonth only, assume 1 month bar
    if(sIdx === null && startMonth !== null && startYear === null){
      sIdx = startMonth;
    }
    if(sIdx !== null && eIdx === null){
      eIdx = Math.min(sIdx + 1, 11);
    }
    // if both null, no bar; still render empty cells
    const hasBar = (sIdx !== null && eIdx !== null && sIdx <= eIdx);

    for(let m=0; m<12; m++){
      const cell = document.createElement('div');
      cell.className = 'grid-col';
      if(hasBar && m>=sIdx && m<=eIdx){
        const bar = document.createElement('div');
        bar.className = 'bar ' + pClass;
        const label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = status;
        bar.appendChild(label);
        cell.appendChild(bar);
      }
      container.appendChild(cell);
    }

    return container;
  }

  function placeTodayLine(){
    const grid = qs('#timelineGrid');
    const todayLine = qs('#todayLine');
    const now = new Date();
    const month = now.getMonth(); // 0..11
    const header = grid.querySelector('.grid-header');
    const headerCols = header.querySelectorAll('.grid-col');
    // header has 13 cols: title + 12 months
    const titleCol = headerCols[0];
    const monthCol = headerCols[month+1];
    const rectGrid = grid.getBoundingClientRect();
    const rectTitle = titleCol.getBoundingClientRect();
    const rectMonth = monthCol.getBoundingClientRect();
    const x = rectMonth.left - rectGrid.left + (rectMonth.width/2);
    todayLine.style.left = `${x}px`;
  }

  async function fetchProjects(){
    const r = await fetch(API);
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }

  function applyFilters(rows){
    const fs = qs('#filterStatus').value.trim();
    const fp = qs('#filterPriority').value.trim();
    const q = qs('#filterSearch').value.trim().toLowerCase();
    return rows.filter(r=>{
      const status = (r['Status']||'').toString();
      const priority = (r['Priority']||'').toString();
      const text = `${r['BRD No']||''} ${r['Project/Fitur']||''} ${r['PIC']||''}`.toLowerCase();
      const okS = fs ? status === fs : true;
      const okP = fp ? priority === fp : true;
      const okQ = q ? text.includes(q) : true;
      return okS && okP && okQ;
    });
  }

  function renderTimeline(rows){
    const gridRows = qs('#gridRows');
    gridRows.innerHTML = '';
    const now = new Date();
    const year = now.getFullYear();
    qs('#yearLabel').textContent = String(year);

    if(!rows || rows.length===0){
      gridRows.innerHTML = '<div class="grid-row"><div class="grid-col grid-col-title">Tidak ada data</div>' +
        '<div class="grid-col" style="grid-column: span 12"></div></div>';
      placeTodayLine();
      return;
    }

    rows.forEach(r=>{
      const rowEl = buildRow(r, year);
      gridRows.appendChild(rowEl);
    });

    placeTodayLine();
  }

  function bindUI(){
    qs('#btnApplyFilter').addEventListener('click', async ()=>{
      try {
        const rows = await fetchProjects();
        renderTimeline(applyFilters(rows));
      } catch(err){ console.error(err); }
    });
    qs('#btnClearFilter').addEventListener('click', async ()=>{
      qs('#filterStatus').value = '';
      qs('#filterPriority').value = '';
      qs('#filterSearch').value = '';
      try {
        const rows = await fetchProjects();
        renderTimeline(rows);
      } catch(err){ console.error(err); }
    });

    // Export PNG
    qs('#btnExportPng').addEventListener('click', ()=>{
      const node = qs('#timelineContainer');
      // use HTML2Canvas via dynamic import (CDN)
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = ()=>{
        window.html2canvas(node).then(canvas=>{
          const url = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = url; a.download = 'project_timeline.png';
          document.body.appendChild(a); a.click(); a.remove();
        });
      };
      document.body.appendChild(s);
    });

    // live filter typing
    qs('#filterSearch').addEventListener('input', async ()=>{
      try {
        const rows = await fetchProjects();
        renderTimeline(applyFilters(rows));
      } catch(err){ console.error(err); }
    });
    qs('#filterStatus').addEventListener('change', async ()=>{
      try {
        const rows = await fetchProjects();
        renderTimeline(applyFilters(rows));
      } catch(err){ console.error(err); }
    });
    qs('#filterPriority').addEventListener('change', async ()=>{
      try {
        const rows = await fetchProjects();
        renderTimeline(applyFilters(rows));
      } catch(err){ console.error(err); }
    });

    // reposition today line on resize
    window.addEventListener('resize', placeTodayLine);
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    bindUI();
    try {
      const rows = await fetchProjects();
      renderTimeline(rows);
    } catch(err){ console.error(err); }
  });

})();
