// [data-parallax="0.15"]  moves at a different speed while scrolling (scrubbed)
// [data-unveil]           image unveils with a clip-path wipe when it enters
//
// Parallax only runs with a mouse/trackpad on wider screens: on touch devices a
// scrubbed tween lags one frame behind the native scroll and visibly jitters.

import gsap from 'gsap';
import { MEDIA, reduceMotion } from './env';

export function initParallax() {
  if (reduceMotion) return;

  const mm = gsap.matchMedia();
  mm.add(MEDIA.full, () => {
    document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
      const speed = parseFloat(el.dataset.parallax || '0.15');
      gsap.fromTo(el, { yPercent: -speed * 50 }, {
        yPercent: speed * 50,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  });

  document.querySelectorAll<HTMLElement>('[data-unveil]').forEach((el) => {
    gsap.fromTo(el,
      { clipPath: 'inset(18% 12% 18% 12% round 2rem)', scale: 1.08 },
      {
        clipPath: 'inset(0% 0% 0% 0% round 1rem)', scale: 1, ease: 'power3.out', duration: 1.4,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
  });
}
