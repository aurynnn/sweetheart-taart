// [data-split] headings reveal word by word. The heading stays hidden (CSS, html.js)
// until it has been split, so it never flashes in fully before animating.

import gsap from 'gsap';
import { MEDIA, reduceMotion } from './env';

function splitWords(el: HTMLElement) {
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
  el.setAttribute('aria-label', el.textContent?.replace(/\s+/g, ' ').trim() || '');
  Array.from(el.childNodes).forEach(walk);
  words.forEach((w) => w.setAttribute('aria-hidden', 'true'));
  return words;
}

export function initSplitText() {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('[data-split]'));
  const markDone = (el: HTMLElement) => el.setAttribute('data-split-done', '');

  if (reduceMotion) {
    headings.forEach(markDone);
    return;
  }

  // Blurring every word is costly on phones; there they only rise and fade.
  const mm = gsap.matchMedia();
  mm.add({ full: MEDIA.full, lite: MEDIA.lite }, (ctx) => {
    const lite = Boolean(ctx.conditions?.lite);
    headings.forEach((el) => {
      if (el.hasAttribute('data-split-done')) return;
      const words = splitWords(el);
      markDone(el);
      // No overflow mask: glowing (text-shadow) headings would get clipped into boxes
      gsap.from(words, {
        yPercent: lite ? 40 : 55,
        rotate: lite ? 0 : 3,
        opacity: 0,
        filter: lite ? 'none' : 'blur(10px)',
        duration: lite ? 0.8 : 1,
        ease: 'expo.out',
        stagger: lite ? 0.05 : 0.07,
        clearProps: 'filter,transform',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
  });
}
