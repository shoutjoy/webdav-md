/* View selection is session-only; source, render settings and desktop layout stay independent. */
(() => {
  const switcher = document.getElementById('mobile-pane-switch');
  const main = document.getElementById('main');
  main.dataset.mobilePane = 'editor';
  switcher.addEventListener('click', event => {
    const button = event.target.closest('button[data-pane]');
    if (!button) return;
    main.dataset.mobilePane = button.dataset.pane;
    switcher.querySelectorAll('button').forEach(item => {
      item.setAttribute('aria-pressed', String(item === button));
    });
  });
})();
