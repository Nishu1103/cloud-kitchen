(function () {
  try {
    var stored = localStorage.getItem('ck.theme');
    document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark';
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
  document.documentElement.dataset.portal = 'customer';
})();
