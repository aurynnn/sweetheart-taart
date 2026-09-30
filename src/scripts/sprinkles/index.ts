// src/scripts/sprinkles — Interactive 3D cupcake scene (three.js).
//
// Mounts on every <canvas data-cupcakes>. three.js is only downloaded once a
// canvas comes near the viewport, rendering pauses while it is off-screen or the
// tab is hidden, and reduced-motion visitors get a single still frame. Visitors who
// asked to save data skip the scene entirely (the section's CSS gradient remains).
//
// Options (data attributes on the canvas):
//   data-cupcakes="7"   number of floating cupcakes (fewer on small screens)
//   data-hearts="18"    number of small glossy hearts
//   data-seed="7"       layout seed, so every visit looks the same

import { saveData } from '../motion/env';
import { mount } from './scene';

const canvases = document.querySelectorAll<HTMLCanvasElement>('canvas[data-cupcakes]');

if (saveData) {
  canvases.forEach((c) => c.remove());
} else {
  // Download three.js only when a cupcake canvas is about to be seen
  const lazy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      lazy.unobserve(entry.target);
      mount(entry.target as HTMLCanvasElement).catch((err) => console.warn('[cupcakes] disabled:', err));
    });
  }, { rootMargin: '400px' });
  canvases.forEach((c) => lazy.observe(c));
}
