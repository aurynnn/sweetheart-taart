// Mobile navigation panel (MobileMenu.astro): open/close, scroll lock, Escape to close,
// focus moves into the panel and back to the toggle, Tab stays inside while open.

const menu = document.getElementById('mobile-menu');
const toggle = document.getElementById('mobile-menu-toggle');

if (menu && toggle) {
  const panel = menu.querySelector<HTMLElement>('.mm-panel')!;
  const focusables = () =>
    Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter((el) => el.offsetParent !== null);

  const isOpen = () => menu.classList.contains('is-open');

  function open() {
    menu!.classList.add('is-open');
    toggle!.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden'; // also pauses Lenis (see motion/smoothScroll.ts)
    // Wait for visibility to flip before focusing
    requestAnimationFrame(() => focusables()[0]?.focus({ preventScroll: true }));
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    menu!.classList.remove('is-open');
    toggle!.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (restoreFocus) toggle!.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', () => (isOpen() ? close() : open()));
  menu.querySelectorAll('[data-menu-close]').forEach((btn) => btn.addEventListener('click', () => close()));
  // Navigating away: don't pull focus back to the header
  menu.querySelectorAll('.mobile-nav-link').forEach((link) => link.addEventListener('click', () => close({ restoreFocus: false })));

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Rotating to landscape on a tablet can cross the desktop breakpoint
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) close({ restoreFocus: false }); });
  // Coming back via the back button (bfcache) must not show a stale open menu
  window.addEventListener('pageshow', () => close({ restoreFocus: false }));
}
