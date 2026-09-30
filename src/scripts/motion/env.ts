// Shared device/preference checks for the motion system.

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Mouse or trackpad — pointer-follow effects (tilt, magnetic) only make sense here */
export const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * gsap.matchMedia() conditions. "lite" covers phones and touch tablets: scrubbed
 * parallax and blur filters stutter there because touch scrolling runs on the
 * compositor while scrubbed tweens run on the main thread.
 */
export const MEDIA = {
  full: '(min-width: 768px) and (hover: hover) and (prefers-reduced-motion: no-preference)',
  lite: '(max-width: 767px), (hover: none)',
} as const;

/** Visitor asked to save data (Chrome/Android "Lite mode", some carriers) */
export const saveData = Boolean((navigator as any).connection?.saveData);
