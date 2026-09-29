// src/scripts/steps.ts — Auto-playing step showcase ("Zo werkt het").
//
// Markup: [data-steps] root with [data-step] buttons and matching [data-step-visual]s.
// - Plays only while the section is visible; each step's progress bar is a CSS
//   animation and the next step starts on its `animationend`, so pausing the
//   animation (hover / focus / hidden tab) pauses the whole showcase.
// - Hovering or focusing a step selects it and holds; leaving resumes.
// - Reduced motion: no autoplay, steps are simply clickable.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll<HTMLElement>('[data-steps]').forEach((root) => {
  const steps = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-step]'));
  const visuals = Array.from(root.querySelectorAll<HTMLElement>('[data-step-visual]'));
  if (!steps.length) return;
  let index = 0;

  const activate = (next: number) => {
    index = (next + steps.length) % steps.length;
    steps.forEach((s, i) => {
      const on = i === index;
      s.classList.toggle('is-active', on);
      s.classList.toggle('is-done', i < index);
      s.setAttribute('aria-selected', String(on));
      // Restart the progress animation of the newly active step
      const bar = s.querySelector<HTMLElement>('[data-step-progress]');
      if (bar && on) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    });
    visuals.forEach((v, i) => v.classList.toggle('is-active', i === index));
  };

  const setPaused = (paused: boolean) => root.classList.toggle('is-paused', paused);

  steps.forEach((step, i) => {
    step.addEventListener('click', () => { activate(i); setPaused(true); });
    step.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { activate(i); setPaused(true); } });
    step.addEventListener('focus', () => { activate(i); setPaused(true); });
    step.querySelector('[data-step-progress]')?.addEventListener('animationend', () => {
      if (step.classList.contains('is-active')) activate(index + 1);
    });
    step.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      steps[(i + dir + steps.length) % steps.length].focus();
    });
  });

  const list = root.querySelector('[data-step-list]');
  list?.addEventListener('pointerleave', () => setPaused(false));
  list?.addEventListener('focusout', (e) => { if (!list.contains((e as FocusEvent).relatedTarget as Node)) setPaused(false); });

  activate(0);
  if (reduceMotion) return;

  // Only run while (mostly) in view
  new IntersectionObserver(([entry]) => root.classList.toggle('is-playing', entry.isIntersecting), { threshold: 0.35 }).observe(root);
});
