// Pre-seed the saved theme before the first paint to avoid a flash of the
// default theme. Loaded as a blocking script from <head>.
(function () {
  try {
    var theme = localStorage.getItem('sitescope_theme');
    if (!theme || ['aurora', 'cyber', 'linear', 'nordic'].indexOf(theme) === -1) return;

    document.documentElement.dataset.theme = theme;

    function apply() {
      document.body.dataset.theme = theme;
    }

    if (document.body) apply();
    else document.addEventListener('DOMContentLoaded', apply, { once: true });
  } catch (error) {
    // Storage can be unavailable (private mode, disabled cookies) — ignore.
  }
})();
