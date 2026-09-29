// src/scripts/motion.ts — Site-wide motion system.
//
// Declarative: pages opt in with data attributes, no per-page JS needed.
//   .animate-on-scroll           fade/rise in when scrolled into view (+ .stagger-N delays)
//   [data-split]                 heading reveals word by word
//   [data-parallax="0.15"]       moves at a different speed while scrolling (scrubbed)
//   [data-counter="2018"]        counts up when visible (data-counter-from optional)
//   [data-tilt]                  3D tilt + light glare following the pointer
//   [data-magnetic]              element is gently pulled toward the pointer
//   [data-marquee]               infinite marquee whose speed follows scroll velocity
//
// Everything degrades gracefully: with prefers-reduced-motion the content is
// simply shown, and without JS the CSS fallback in global.css shows it too.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.classList.add('motion-ready');

// ── Smooth scroll ────────────────────────────────────────────────────────────
let lenis: Lenis | null = null;
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
    lenis!.scrollTo(target as HTMLElement, { offset: -24 });
  });
}

(window as any).__lenis = lenis;

// ── Scroll progress bar ──────────────────────────────────────────────────────
const progress = document.getElementById('scroll-progress');
if (progress) {
  gsap.to(progress, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
  });
}

// ── Reveal on scroll ─────────────────────────────────────────────────────────
const reveals = gsap.utils.toArray<HTMLElement>('.animate-on-scroll');
if (reduceMotion) {
  reveals.forEach((el) => el.classList.add('visible'));
} else {
  ScrollTrigger.batch(reveals, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => batch.forEach((el) => el.classList.add('visible')),
  });
}

// ── Split-word headings ──────────────────────────────────────────────────────
function splitWords(el: HTMLElement) {
  if (el.dataset.splitDone) return [];
  el.dataset.splitDone = '1';
  const words: HTMLElement[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = (node.textContent || '').split(/(\s+)/);
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.append(part); continue; }
        const mask = document.createElement('span');
        mask.className = 'split-mask';
        const word = document.createElement('span');
        word.className = 'split-word';
        word.textContent = part;
        mask.append(word);
        frag.append(mask);
        words.push(word);
      }
      node.parentNode!.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName !== 'BR') {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  Array.from(el.childNodes).forEach(walk);
  el.setAttribute('aria-label', el.textContent?.replace(/\s+/g, ' ').trim() || '');
  return words;
}

document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
  if (reduceMotion) return;
  const words = splitWords(el);
  words.forEach((w) => w.setAttribute('aria-hidden', 'true'));
  // No overflow mask: glowing (text-shadow) headings would get clipped into boxes
  gsap.from(words, {
    yPercent: 55,
    rotate: 3,
    opacity: 0,
    filter: 'blur(10px)',
    duration: 1,
    ease: 'expo.out',
    stagger: 0.07,
    clearProps: 'filter',
    scrollTrigger: { trigger: el, start: 'top 85%', once: true },
  });
});

// ── Parallax ─────────────────────────────────────────────────────────────────
if (!reduceMotion) {
  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    const speed = parseFloat(el.dataset.parallax || '0.15');
    gsap.fromTo(el, { yPercent: -speed * 50 }, {
      yPercent: speed * 50,
      ease: 'none',
      scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // Images that unveil with a clip-path wipe
  document.querySelectorAll<HTMLElement>('[data-unveil]').forEach((el) => {
    gsap.fromTo(el,
      { clipPath: 'inset(18% 12% 18% 12% round 2rem)', scale: 1.08 },
      {
        clipPath: 'inset(0% 0% 0% 0% round 1rem)', scale: 1, ease: 'power3.out', duration: 1.4,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
  });
}

// ── Counters ─────────────────────────────────────────────────────────────────
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

// ── Tilt cards ───────────────────────────────────────────────────────────────
if (finePointer && !reduceMotion) {
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const max = parseFloat(el.dataset.tilt || '8');
    const glare = document.createElement('span');
    glare.className = 'tilt-glare';
    glare.setAttribute('aria-hidden', 'true');
    el.append(glare);
    const rx = gsap.quickTo(el, 'rotateX', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotateY', { duration: 0.5, ease: 'power3' });
    gsap.set(el, { transformPerspective: 900, transformStyle: 'preserve-3d' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      rx((0.5 - py) * max);
      ry((px - 0.5) * max);
      glare.style.setProperty('--gx', `${px * 100}%`);
      glare.style.setProperty('--gy', `${py * 100}%`);
      el.classList.add('is-tilting');
    });
    el.addEventListener('pointerleave', () => {
      rx(0); ry(0);
      el.classList.remove('is-tilting');
    });
  });
}

// ── Magnetic buttons ─────────────────────────────────────────────────────────
if (finePointer && !reduceMotion) {
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic || '0.3');
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * strength);
      y((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}

// ── Velocity-reactive marquee ────────────────────────────────────────────────
document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((track) => {
  if (reduceMotion) return;
  // Duplicate content once so the loop is seamless
  track.innerHTML += track.innerHTML;
  track.querySelectorAll('[data-marquee-item]').forEach((el, i, all) => {
    if (i >= all.length / 2) el.setAttribute('aria-hidden', 'true');
  });
  const reverse = track.dataset.marquee === 'reverse';
  const tween = gsap.fromTo(track,
    { xPercent: reverse ? -50 : 0 },
    { xPercent: reverse ? 0 : -50, ease: 'none', duration: parseFloat(track.dataset.marqueeDuration || '30'), repeat: -1 });
  // Scrolling speeds the marquee up, then it eases back to its resting pace
  let boost = 1;
  gsap.ticker.add(() => {
    const target = 1 + Math.min(Math.abs(scrollVelocity) / 8, 4);
    boost += (target - boost) * 0.08;
    tween.timeScale(boost);
  });
});

// Images/fonts loading late shift layout — keep trigger positions correct
window.addEventListener('load', () => ScrollTrigger.refresh());
