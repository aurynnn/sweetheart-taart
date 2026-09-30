// [data-counter="2018"]  counts up when visible (data-counter-from / -suffix optional)

import gsap from 'gsap';
import { reduceMotion } from './env';

export function initCounters() {
  document.querySelectorAll<HTMLElement>('[data-counter]').forEach((el) => {
    const to = parseFloat(el.dataset.counter || '0');
    const from = parseFloat(el.dataset.counterFrom || '0');
    const suffix = el.dataset.counterSuffix || '';
    const render = (n: number) => { el.textContent = Math.round(n).toString() + suffix; };
    if (reduceMotion) { render(to); return; }
    const state = { n: from };
    render(from);
    gsap.to(state, {
      n: to,
      duration: 2,
      ease: 'power2.out',
      onUpdate: () => render(state.n),
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
}
