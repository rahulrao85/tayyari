// Applies the saved or system theme before first paint, so there is no flash.
(function () {
  var theme = 'light';
  try {
    var saved = localStorage.getItem('tayyari-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  } catch {
    /* storage blocked: keep the light theme */
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
