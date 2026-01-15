// loading.js
window.showLoading = function() {
  const el = document.getElementById('loadingScreen');
  if (el) el.classList.remove('hidden');
};
window.hideLoading = function() {
  const el = document.getElementById('loadingScreen');
  if (el) el.classList.add('hidden');
};
