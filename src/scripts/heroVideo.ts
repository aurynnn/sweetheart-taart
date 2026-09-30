// Home hero background video: trims a few frames off both ends of the clip (they
// contain a camera jolt) and loops seamlessly between those points. It also pauses
// while scrolled out of view or in a background tab (saves battery on phones), and
// stays on its first frame for visitors who prefer reduced motion.

const FRAME_RATE = 30;
const SKIP_START_FRAMES = 9;
const SKIP_END_FRAMES = 12;

export function initHeroVideo(video: HTMLVideoElement) {
  const startTime = SKIP_START_FRAMES / FRAME_RATE;
  const endOffset = SKIP_END_FRAMES / FRAME_RATE;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const toStart = () => { video.currentTime = startTime; };
  if (video.readyState >= 1) toStart();
  else video.addEventListener('loadedmetadata', toStart, { once: true });

  if (reduceMotion) {
    video.removeAttribute('autoplay');
    video.pause();
    return;
  }

  const pastEnd = (t: number) => video.duration && t >= video.duration - endOffset;

  // Per-frame check where supported (accurate loop point); `timeupdate` only fires
  // ~4×/s, which lets a few of the trimmed frames slip through.
  if (typeof video.requestVideoFrameCallback === 'function') {
    const onFrame = (_now: number, meta: { mediaTime: number }) => {
      if (pastEnd(meta.mediaTime)) toStart();
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  } else {
    video.addEventListener('timeupdate', () => { if (pastEnd(video.currentTime)) toStart(); });
  }

  // Only play while the hero is on screen and the tab is visible
  let onScreen = true;
  const sync = () => {
    if (onScreen && !document.hidden) video.play().catch(() => { /* autoplay blocked (e.g. iOS Low Power Mode): the poster stays */ });
    else video.pause();
  };
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }).observe(video);
  document.addEventListener('visibilitychange', sync);
}

const hero = document.getElementById('heroVideo');
if (hero instanceof HTMLVideoElement) initHeroVideo(hero);
