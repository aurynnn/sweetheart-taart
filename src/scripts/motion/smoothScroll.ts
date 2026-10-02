// Lenis smooth scrolling (wheel/trackpad only — touch keeps native momentum scrolling)
// kept in sync with ScrollTrigger. Also exposes the current scroll velocity, which
// the marquee and the 3D cupcake scene react to.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { reduceMotion } from './env';

gsap.registerPlugin(ScrollTrigger);

// Mobile browsers resize the viewport when the address bar shows/hides. Recalculating
// every trigger then makes reveals and parallax jump mid-scroll.
ScrollTrigger.config({ ignoreMobileResize: true });

export let lenis: Lenis | null = null;
export let scrollVelocity = 0;

if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', (e: Lenis) => {
    scrollVelocity = e.velocity;
    ScrollTrigger.update();
  });
  gsap.ticker.add((time) => lenis!.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Pause smooth scrolling while a modal locks the page (body overflow hidden)
  const syncLock = () => {
    const locked = document.body.style.overflow === 'hidden' || document.documentElement.style.overflow === 'hidden';
    locked ? lenis!.stop() : lenis!.start();
  };
  new MutationObserver(syncLock).observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });

  // In-page anchor links scroll smoothly through Lenis
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a || a.getAttribute('href') === '#') return;
    const target = document.querySelector(a.getAttribute('href')!);
    if (!target) return;
    e.preventDefault();
    lenis!.scrollTo(target as HTMLElement, { offset: -88 }); // clear the fixed header
  });
}

// Used by components that scroll programmatically (e.g. the aanvraag wizard)
(window as any).__lenis = lenis;
