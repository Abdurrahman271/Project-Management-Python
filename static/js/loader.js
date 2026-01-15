// static/js/loader.js
const Loader = (function(){
  const el = () => document.getElementById('siteLoader');
  const msg = () => document.getElementById('loaderMessage');
  const fill = () => document.getElementById('loaderProgressFill');

  function show(initialMessage = 'Memuat aplikasi...', withProgress = false){
    const node = el();
    if(!node) return;
    node.classList.remove('hidden');
    if(msg()) msg().textContent = initialMessage;
    if(fill()){
      fill().style.width = withProgress ? '6%' : '100%';
      fill().style.transition = 'width .45s ease';
    }
  }

  function hide(){
    const node = el();
    if(!node) return;
    node.classList.add('hidden');
    if(fill()) fill().style.width = '0%';
  }

  function setProgress(percent, message){
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    if(fill()) fill().style.width = `${p}%`;
    if(msg() && message !== undefined) msg().textContent = String(message);
  }

  return { show, hide, setProgress };
})();
