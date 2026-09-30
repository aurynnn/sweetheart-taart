// Pointer-follow effects, mouse/trackpad only (they have no meaning on touch):
//   [data-tilt]      3D tilt + light glare following the pointer
//   [data-magnetic]  element is gently pulled toward the pointer

import gsap from 'gsap';
import { finePointer, reduceMotion } from './env';

function initTilt() {
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const max = parseFloat(el.dataset.tilt || '8');
    const glare = document.createElement('span');
    glare.className = 'tilt-glare';
    glare.setAttribute('aria-hidden', 'true');
    el.append(glare);
    el.style.willChange = 'transform';
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

function initMagnetic() {
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

export function initPointerEffects() {
  if (!finePointer || reduceMotion) return;
  initTilt();
  initMagnetic();
}
