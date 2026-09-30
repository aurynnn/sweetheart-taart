// src/scripts/motion — Site-wide motion system.
//
// Declarative: pages opt in with data attributes, no per-page JS needed.
//   .animate-on-scroll           fade/rise in when scrolled into view (+ .stagger-N delays)
//   .animate-on-load             CSS-only entrance for above-the-fold content (no JS needed)
//   [data-split]                 heading reveals word by word
//   [data-parallax="0.15"]       moves at a different speed while scrolling (desktop only)
//   [data-unveil]                image unveils with a clip-path wipe
//   [data-counter="2018"]        counts up when visible (data-counter-from optional)
//   [data-tilt]                  3D tilt + light glare following the pointer (mouse only)
//   [data-magnetic]              element is gently pulled toward the pointer (mouse only)
//   [data-marquee]               infinite marquee whose speed follows scroll velocity
//
// Everything degrades gracefully: with prefers-reduced-motion the content is simply
// shown, and the hidden start states only apply once <html> has the `js` class
// (set inline in Layout.astro), with a CSS failsafe should this bundle never load.

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './smoothScroll';
import { initProgress } from './progress';
import { initReveal } from './reveal';
import { initSplitText } from './splitText';
import { initParallax } from './parallax';
import { initCounters } from './counters';
import { initPointerEffects } from './pointer';
import { initMarquees } from './marquee';

document.documentElement.classList.add('motion-ready');

initProgress();
initSplitText();
initReveal();
initParallax();
initCounters();
initPointerEffects();
initMarquees();

// Images/fonts loading late shift layout — keep trigger positions correct
window.addEventListener('load', () => ScrollTrigger.refresh());
