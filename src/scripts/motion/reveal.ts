// .animate-on-scroll → gets .visible when scrolled into view (CSS does the animation,
// see styles/motion.css). Elements already in or above the viewport are shown at once.

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reduceMotion } from './env';

export function initReveal() {
  const reveals = Array.from(document.querySelectorAll<HTMLElement>('.animate-on-scroll'));
  const reveal = (els: Element[]) => els.forEach((el) => el.classList.add('visible'));

  if (reduceMotion) {
    reveal(reveals);
    return;
  }

  /**
   * Anything already scrolled past (or in view) must be shown. Without this, a page that
   * opens mid-way — reload, restored scroll position, #anchor link — leaves the elements
   * above the viewport invisible, because they never get an "enter" moment.
   */
  const revealPassed = () => {
    const line = window.innerHeight * 0.92;
    reveal(reveals.filter((el) => !el.classList.contains('visible') && el.getBoundingClientRect().top < line));
  };

  ScrollTrigger.batch(reveals, {
    start: 'top 88%',
    once: true,
    onEnter: reveal,
    onEnterBack: reveal,
  });
  revealPassed();
  ScrollTrigger.addEventListener('refresh', revealPassed);
  window.addEventListener('hashchange', () => requestAnimationFrame(revealPassed));
  window.addEventListener('pageshow', revealPassed); // back/forward cache

  // Safety net: never leave content hidden when scrolling jumps (anchors, restored position)
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { revealPassed(); ticking = false; });
  }, { passive: true });
}
