// Home hero background video: trims a few frames off both ends of the clip (they
// contain a camera jolt) and loops seamlessly between those points. It also pauses
// while scrolled out of view or in a background tab (saves battery on phones), and
// stays on its first frame for visitors who prefer reduced motion.
//
// The video is invisible until it really plays (`.is-playing` on .hero-media); until then,
// or if it never plays (iOS Low Power Mode, data saver, a failed download), the hero shows
// its photo background instead of a black box or Safari's play button.

const FRAME_RATE = 30;
const SKIP_START_FRAMES = 5;
const SKIP_END_FRAMES = 0;

export function initHeroVideo(video: HTMLVideoElement) {
  const startTime = SKIP_START_FRAMES / FRAME_RATE;
  const endOffset = SKIP_END_FRAMES / FRAME_RATE;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const media = video.closest('.hero-media');
  const saveData = (navigator as any).connection?.saveData === true;

  video.addEventListener('playing', () => media?.classList.add('is-playing'));

  // Phones should get the light 720p file; some browsers pick a <source> before the
  // mobile viewport applies and start the 1080p one instead
  const preferLight = () => {
    if (window.matchMedia('(max-width: 767px)').matches && video.currentSrc.includes('-1080')) {
      video.src = video.currentSrc.replace('-1080', '-720');
      video.load();
    }
  };
  if (video.currentSrc) preferLight();
  else video.addEventListener('loadstart', preferLight, { once: true });

  // Data saver: don't download the video at all, the photo background stays
  if (saveData) {
    video.removeAttribute('autoplay');
    video.preload = 'none';
    video.querySelectorAll('source').forEach((s) => s.remove());
    video.load();
    return;
  }

  const toStart = () => { video.currentTime = startTime; };
  if (video.readyState >= 1) toStart();
  else video.addEventListener('loadedmetadata', toStart, { once: true });

  if (reduceMotion) {
    video.removeAttribute('autoplay');
    video.pause();
    // Show the still first frame instead of the photo once it has loaded
    video.addEventListener('seeked', () => media?.classList.add('is-playing'), { once: true });
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
  // iOS returns from the bfcache with the video paused
  window.addEventListener('pageshow', sync);
  // Autoplay blocked (iOS Low Power Mode)? A first tap or scroll counts as permission
  const retry = () => { if (video.paused) sync(); };
  for (const type of ['touchstart', 'pointerdown', 'scroll'] as const) {
    window.addEventListener(type, retry, { once: true, passive: true });
  }
}

const hero = document.getElementById('heroVideo');
if (hero instanceof HTMLVideoElement) initHeroVideo(hero);
