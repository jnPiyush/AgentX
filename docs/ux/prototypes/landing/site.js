'use strict';

(() => {
  const requestedTheme = new URLSearchParams(window.location.search).get('scoutTheme');
  const theme = requestedTheme === 'dark' || requestedTheme === 'light'
    ? requestedTheme
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);

  window.addEventListener('DOMContentLoaded', () => {
    const menu = document.querySelector('.menu-button');
    const links = document.getElementById('primary-links');
    const status = document.getElementById('copy-status');

    const setMenuOpen = (open, restoreFocus = false) => {
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      links.dataset.open = String(open);
      if (!open && restoreFocus) {
        menu.focus();
      }
    };

    menu.addEventListener('click', () => {
      setMenuOpen(menu.getAttribute('aria-expanded') !== 'true');
    });
    links.addEventListener('click', (event) => {
      if (event.target.matches('a')) {
        setMenuOpen(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false, true);
      }
    });

    document.querySelectorAll('[data-copy-target]').forEach((button) => {
      button.addEventListener('click', async () => {
        const target = document.getElementById(button.dataset.copyTarget);
        const value = target.textContent.trim();
        try {
          await navigator.clipboard.writeText(value);
          button.textContent = 'Copied';
          status.textContent = 'Install command copied.';
        } catch {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(target);
          selection.removeAllRanges();
          selection.addRange(range);
          button.textContent = 'Selected';
          status.textContent = 'Clipboard access is unavailable. The install command is selected; copy it manually.';
        }
        status.hidden = false;
        window.setTimeout(() => { button.textContent = 'Copy'; }, 1800);
      });
    });
  });
})();
