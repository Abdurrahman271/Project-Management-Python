// static/js/timeline.js
// Fetch timeline events and render interactive timeline with simple filters.

(function(){
  'use strict';

  const api = '/api/timeline/events';

  function qs(s){ return document.querySelector(s); }
  function el(tag, cls){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }

  function parseDate(d){
    try {
      const dt = new Date(d);
      if(isNaN(dt)) return d;
      return dt.toLocaleDateString();
    } catch(e){ return d; }
  }

  function buildItem(ev){
    const item = el('div','timeline-item');
    const bullet = el('div','timeline-bullet ' + (ev.type === 'completed' ? 'bullet-completed' : 'bullet-submit'));
    bullet.innerHTML = ev.type === 'completed' ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-upload"></i>';
    item.appendChild(bullet);
    const title = el('div');
    title.innerHTML = `<div style="font-weight:700">${ev.title || '-'}</div>
      <div class="meta">${ev.brd || ''} • ${ev.pic || ''} • ${parseDate(ev.date)}</div>
      <div style="margin-top:6px;color:#374151;font-size:13px">${ev.note || ''}</div>`;
    item.appendChild(title);
    return item;
  }

  async function fetchEvents(){
    try {
      const r = await fetch(api);
      if(!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      return j.events || [];
    } catch(e){
      console.error(e);
      return [];
    }
  }

  function renderTimeline(events){
    const container = qs('#timeline');
    container.innerHTML = '';
    if(!events || events.length === 0){
      container.innerHTML = '<div class="text-muted">Tidak ada event</div>';
      return;
    }
    events.forEach(ev => {
      const item = buildItem(ev);
      container.appendChild(item);
    });
  }

  function applyFilters(events){
    const type = qs('#filterType') ? qs('#filterType').value : '';
    const q = qs('#filterText') ? qs('#filterText').value.trim().toLowerCase() : '';
    const filtered = events.filter(ev => {
      if(type && ev.type !== type) return false;
      if(q){
        const hay = ((ev.title||'') + ' ' + (ev.brd||'') + ' ' + (ev.pic||'') + ' ' + (ev.note||'')).toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
    renderTimeline(filtered);
  }

  async function init(){
    const events = await fetchEvents();
    renderTimeline(events);
    qs('#btnFilterTimeline').addEventListener('click', ()=> applyFilters(events));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
