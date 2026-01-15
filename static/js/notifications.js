// notifications.js - lightweight notification center + toast
(function(){
  'use strict';
  function qs(s,r=document){return r.querySelector(s)}
  let notifications = [], unreadCount = 0, toastTimer = null;

  function ensureUI(){
    if (qs('#notifBell')) return;
    const header = qs('.header-actions') || document.body;
    const wrapper = document.createElement('div'); wrapper.className = 'notification-bell ms-2';
    wrapper.innerHTML = `<button id="notifBell" class="btn btn-outline-secondary" title="Notifications"><i class="fa-solid fa-bell"></i></button><span id="notifBadge" class="badge-notif" style="display:none">0</span>`;
    header.insertBefore(wrapper, header.firstChild);

    const panel = document.createElement('div'); panel.id='notifPanel'; panel.className='notification-panel';
    panel.innerHTML = `<div class="panel-header"><div class="title">Notifications</div><div><button id="btnMarkAllRead" class="btn btn-sm btn-outline-secondary">Mark all read</button></div></div><div class="panel-body"></div><div class="panel-footer" style="display:flex;justify-content:space-between;padding:10px;border-top:1px solid #eef2f7"><small id="notifFooterText">No notifications</small><button id="btnClearAll" class="btn btn-sm btn-outline-danger">Clear</button></div>`;
    document.body.appendChild(panel);

    const toast = document.createElement('div'); toast.id='notifToast'; toast.className='notif-toast'; toast.style.display='none'; document.body.appendChild(toast);

    qs('#notifBell').addEventListener('click', togglePanel);
    qs('#btnMarkAllRead').addEventListener('click', markAllRead);
    qs('#btnClearAll').addEventListener('click', clearAll);
    document.addEventListener('click', (e)=>{ if (!panel.contains(e.target) && !qs('#notifBell').contains(e.target)) hidePanel(); });
  }

  function renderPanel(){
    const body = qs('#notifPanel .panel-body'); const footer = qs('#notifFooterText');
    if (!body) return;
    body.innerHTML = '';
    if (!notifications.length) { body.innerHTML = `<div class="text-muted small p-3">Belum ada notifikasi</div>`; footer.textContent='0 notifications'; updateBadge(); return; }
    notifications.slice().reverse().forEach(n=>{
      const item = document.createElement('div'); item.className='notification-item'; item.dataset.id=n.id;
      item.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:${n.read?'#94a3b8':'#60a5fa'};margin-top:6px"></div><div class="content"><div class="title" style="font-weight:600">${escapeHtml(n.title)}</div><div class="msg" style="font-size:13px;color:#475569;margin-top:4px">${escapeHtml(n.message)}</div><div class="meta" style="font-size:11px;color:#94a3b8;margin-top:6px">${escapeHtml(n.time||'')}</div></div>`;
      item.addEventListener('click', ()=>{ markRead(n.id); if (n.url) window.location.href = n.url; });
      body.appendChild(item);
    });
    footer.textContent = `${notifications.length} notifications`;
    updateBadge();
  }

  function updateBadge(){ const badge = qs('#notifBadge'); if (!badge) return; unreadCount = notifications.filter(n=>!n.read).length; if (unreadCount>0){ badge.style.display=''; badge.textContent = unreadCount>99?'99+':String(unreadCount);} else badge.style.display='none'; }

  function togglePanel(){ const panel = qs('#notifPanel'); if (!panel) return; panel.classList.toggle('visible'); qs('#notifBell').setAttribute('aria-expanded', panel.classList.contains('visible')?'true':'false'); renderPanel(); }
  function hidePanel(){ const panel = qs('#notifPanel'); if (panel) panel.classList.remove('visible'); if (qs('#notifBell')) qs('#notifBell').setAttribute('aria-expanded','false'); }

  function showToast(title,message,opts={timeout:3500}){ const t = qs('#notifToast'); if (!t) return; t.innerHTML = `<div style="font-weight:700">${escapeHtml(title)}</div><div style="font-size:13px;opacity:.95;margin-top:6px">${escapeHtml(message)}</div>`; t.style.display=''; setTimeout(()=>t.classList.add('show'),10); if (toastTimer) clearTimeout(toastTimer); toastTimer = setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=> t.style.display='none',200); }, opts.timeout||3500); }

  function pushNotification(obj){ const n = Object.assign({ id: String(Date.now())+Math.random().toString(36).slice(2), time: new Date().toLocaleString(), read:false }, obj); notifications.push(n); updateBadge(); renderPanel(); showToast(n.title, n.message); }

  function markRead(id){ const i = notifications.findIndex(x=>String(x.id)===String(id)); if (i!==-1) { notifications[i].read = true; renderPanel(); } }
  function markAllRead(){ notifications.forEach(n=>n.read=true); renderPanel(); }
  function clearAll(){ if (!confirm('Hapus semua notifikasi?')) return; notifications = []; renderPanel(); }

  window.Notifications = { init: function(opts={}){ ensureUI(); renderPanel(); }, push: pushNotification, toast: showToast, markRead, markAllRead, clearAll, getAll: ()=> notifications.slice() };

  function escapeHtml(s){ if(s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  document.addEventListener('DOMContentLoaded', function(){ Notifications.init({ pollInterval:0 }); });

})();
