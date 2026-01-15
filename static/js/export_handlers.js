// static/js/export_handlers.js
// Lightweight download with progress overlay (optional)

(function(window){
  'use strict';

  function formatBytes(bytes){
    if(!bytes) return '0 B';
    const sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes)/Math.log(1024));
    return (bytes/Math.pow(1024,i)).toFixed(2) + ' ' + sizes[i];
  }

  async function downloadWithProgress(url, filename, mime){
    const resp = await fetch(url);
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    const total = parseInt(resp.headers.get('content-length') || '0', 10) || 0;
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    while(true){
      const { done, value } = await reader.read();
      if(done) break;
      chunks.push(value);
      received += value.length || value.byteLength || 0;
    }
    const blob = new Blob(chunks, { type: mime || resp.headers.get('content-type') || 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function bindExportButtons(opts = {}){
    const btnX = document.getElementById(opts.excelButtonId || 'btnExportExcel');
    const btnP = document.getElementById(opts.pdfButtonId || 'btnExportPDF');
    if(btnX){
      btnX.addEventListener('click', async function(){
        try { btnX.disabled = true; await downloadWithProgress('/api/projects/export/excel','projects.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }
        catch(e){ alert('Gagal mengunduh Excel: ' + (e.message || e)); }
        finally { btnX.disabled = false; }
      });
    }
    if(btnP){
      btnP.addEventListener('click', async function(){
        try { btnP.disabled = true; await downloadWithProgress('/api/projects/export/pdf','projects.pdf','application/pdf'); }
        catch(e){ window.open('/api/projects/export/pdf-fallback','_blank'); }
        finally { btnP.disabled = false; }
      });
    }
  }

  window.exportHandlers = window.exportHandlers || {};
  window.exportHandlers.bindExportButtons = bindExportButtons;
  window.exportHandlers.downloadBinaryWithProgress = downloadWithProgress;

})(window);
