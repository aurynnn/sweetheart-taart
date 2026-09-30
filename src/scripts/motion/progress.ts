// Thin progress bar at the top of the page that fills while scrolling.

import gsap from 'gsap';

export function initProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  gsap.to(bar, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
  });
}
