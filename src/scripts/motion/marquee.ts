// [data-marquee]  infinite marquee whose speed follows scroll velocity.
// Paused while off-screen so it costs nothing when you can't see it.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reduceMotion } from './env';
import { scrollVelocity } from './smoothScroll';

export function initMarquees() {
  if (reduceMotion) return;
  document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((track) => {
    // Duplicate content once so the loop is seamless
    track.innerHTML += track.innerHTML;
    track.querySelectorAll('[data-marquee-item]').forEach((el, i, all) => {
      if (i >= all.length / 2) el.setAttribute('aria-hidden', 'true');
    });
    const reverse = track.dataset.marquee === 'reverse';
    const tween = gsap.fromTo(track,
      { xPercent: reverse ? -50 : 0 },
      { xPercent: reverse ? 0 : -50, ease: 'none', duration: parseFloat(track.dataset.marqueeDuration || '30'), repeat: -1, paused: true });

    // Scrolling speeds the marquee up, then it eases back to its resting pace
    let boost = 1;
    const speed = () => {
      const target = 1 + Math.min(Math.abs(scrollVelocity) / 8, 4);
      boost += (target - boost) * 0.08;
      tween.timeScale(boost);
    };

    ScrollTrigger.create({
      trigger: track,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: ({ isActive }) => {
        if (isActive) { tween.play(); gsap.ticker.add(speed); }
        else { tween.pause(); gsap.ticker.remove(speed); }
      },
    });
  });
}
