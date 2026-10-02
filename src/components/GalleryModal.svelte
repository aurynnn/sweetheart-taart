<script>
// GalleryModal.svelte
// Photo/video grid with a lightbox. Shows `rowsToShow` clear rows plus one extra
// row that fades out behind a blur, hinting there is more. "Toon meer" adds rows.
// Rows are measured from the real grid, so the blurred row is always exactly one row.

import { onMount, tick } from 'svelte';

let { images = [], rowsToShow = 2, rowsToAdd = 4 } = $props();

let isOpen = $state(false);
let currentIndex = $state(0);
let visibleRows = $state(rowsToShow + 1); // 2 clear rows + 1 blurred row
let activeFilter = $state('image'); // 'image' | 'video'
let columns = $state(6);
let broken = $state(new Set()); // files that turned out not to be images/videos
let loaded = $state(new Set());
let revealFrom = $state(0); // index where the latest "Toon meer" batch starts (for stagger)
let grid;
let strip;
let touchStartX = 0;
let touchStartY = 0;

function isVideo(item) {
  return item.type === 'video' || /\.(mp4|webm|mov)$/i.test(item.src || '');
}

let filteredImages = $derived(
  images.filter((img) => (activeFilter === 'video' ? isVideo(img) : !isVideo(img)) && !broken.has(img.src))
);
let imageCount = $derived(images.filter((img) => !isVideo(img) && !broken.has(img.src)).length);
let videoCount = $derived(images.filter((img) => isVideo(img) && !broken.has(img.src)).length);

let visibleCount = $derived(visibleRows * columns);
let hasMore = $derived(filteredImages.length > visibleCount);
let blurFrom = $derived(hasMore ? (visibleRows - 1) * columns : Infinity);
let shown = $derived(filteredImages.slice(0, visibleCount));

// Lightbox strip: only render thumbnails around the current one
let stripStart = $derived(Math.max(0, currentIndex - 12));
let stripItems = $derived(filteredImages.slice(stripStart, currentIndex + 13));

onMount(() => {
  const measure = () => {
    if (!grid) return;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    if (cols > 0) columns = cols;
  };
  const ro = new ResizeObserver(measure);
  ro.observe(grid);
  measure();
  return () => ro.disconnect();
});

function setFilter(f) {
  activeFilter = f;
  visibleRows = rowsToShow + 1;
  revealFrom = 0;
}

function markBroken(src) {
  broken = new Set([...broken, src]);
}

function markLoaded(src) {
  loaded = new Set([...loaded, src]);
}

function showMoreRows() {
  revealFrom = blurFrom;
  visibleRows += rowsToAdd;
}

async function showLess() {
  visibleRows = rowsToShow + 1;
  revealFrom = 0;
  await tick();
  grid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function openGallery(index = 0) {
  currentIndex = index;
  isOpen = true;
  document.body.style.overflow = 'hidden';
  await tick();
  scrollStrip();
}

function closeGallery() {
  isOpen = false;
  document.body.style.overflow = '';
}

async function go(delta) {
  currentIndex = (currentIndex + delta + filteredImages.length) % filteredImages.length;
  // Warm the cache for the next photo in the same direction
  const next = filteredImages[(currentIndex + delta + filteredImages.length) % filteredImages.length];
  if (next && !isVideo(next)) new Image().src = next.src;
  await tick();
  scrollStrip();
}

function scrollStrip() {
  strip?.querySelector('.strip-thumb.active')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function handleKeydown(e) {
  if (!isOpen) return;
  if (e.key === 'Escape') closeGallery();
  if (e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowLeft') go(-1);
}

function onTouchStart(e) {
  touchStartX = e.changedTouches[0].clientX;
  touchStartY = e.changedTouches[0].clientY;
}

// Swipe left/right to browse, swipe down to close (the usual phone photo-viewer gestures)
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) closeGallery();
}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Filter Buttons -->
<div class="gallery-filter-buttons" role="tablist" aria-label="Soort media">
  <button
    class="filter-btn {activeFilter === 'image' ? 'active' : ''}"
    role="tab"
    aria-selected={activeFilter === 'image'}
    onclick={() => setFilter('image')}
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
    <span>Foto's</span>
    <span class="badge">{imageCount}</span>
  </button>

  {#if videoCount > 0}
    <button
      class="filter-btn {activeFilter === 'video' ? 'active' : ''}"
      role="tab"
      aria-selected={activeFilter === 'video'}
      onclick={() => setFilter('video')}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
      <span>Video's</span>
      <span class="badge">{videoCount}</span>
    </button>
  {/if}
</div>

<!-- Thumbnails Grid -->
<div class="gallery-dropdown">
  <div class="thumbnails-grid" bind:this={grid}>
    {#each shown as img, i (img.src)}
      {@const blurred = i >= blurFrom}
      <button
        class="thumbnail {blurred ? 'blurred' : ''} {loaded.has(img.src) ? 'is-loaded' : ''} {i >= revealFrom && revealFrom > 0 ? 'reveal' : ''}"
        style="--d: {Math.max(0, i - revealFrom) * 25}ms"
        onclick={() => (blurred ? showMoreRows() : openGallery(i))}
        tabindex={blurred ? -1 : 0}
        aria-label={blurred ? 'Toon meer' : `Open ${isVideo(img) ? 'video' : 'foto'} ${i + 1}`}
      >
        {#if isVideo(img)}
          <div class="thumbnail-video-wrapper">
            {#if img.thumb}
              <img
                src={img.thumb}
                alt=""
                loading="lazy"
                decoding="async"
                class="thumbnail-video-img"
                onload={() => markLoaded(img.src)}
                onerror={() => markBroken(img.src)}
              />
            {:else}
              <!-- #t= shows a real frame of the video as its thumbnail -->
              <video
                src="{img.src}#t=0.5"
                preload="metadata"
                muted
                playsinline
                class="thumbnail-video-img"
                onloadeddata={() => markLoaded(img.src)}
                onerror={() => markBroken(img.src)}
              ></video>
            {/if}
            <div class="video-play-indicator">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        {:else}
          <img
            src={img.thumb || img.src}
            alt={img.alt}
            loading="lazy"
            decoding="async"
            onload={() => markLoaded(img.src)}
            onerror={() => markBroken(img.src)}
          />
          <div class="thumbnail-overlay">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        {/if}
      </button>
    {/each}
  </div>

  {#if hasMore}
    <div class="show-more-container">
      <button class="show-more-btn" onclick={showMoreRows}>
        <span>Toon meer <small>({filteredImages.length - blurFrom} {activeFilter === 'video' ? "video's" : "foto's"})</small></span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  {:else if visibleRows > rowsToShow + 1}
    <div class="show-more-container less">
      <button class="show-more-btn" onclick={showLess}>
        <span>Toon minder</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
    </div>
  {/if}

  {#if filteredImages.length === 0}
    <p class="no-content">Geen {activeFilter === 'video' ? "video's" : "foto's"} beschikbaar</p>
  {/if}
</div>

<!-- Lightbox -->
{#if isOpen && filteredImages[currentIndex]}
  {@const item = filteredImages[currentIndex]}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closeGallery} role="dialog" aria-modal="true" aria-label="Galerij" data-lenis-prevent>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()} ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
      <button class="modal-close" onclick={closeGallery} aria-label="Sluiten">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div class="modal-counter">{currentIndex + 1} / {filteredImages.length}</div>

      <div class="modal-image-container">
        {#key item.src}
          {#if isVideo(item)}
            <video src={item.src} controls autoplay playsinline class="modal-video"><track kind="captions" /></video>
          {:else}
            <img src={item.src} alt={item.alt} class="modal-image" />
          {/if}
        {/key}

        {#if filteredImages.length > 1}
          <button class="nav-btn nav-prev" onclick={() => go(-1)} aria-label="Vorige">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button class="nav-btn nav-next" onclick={() => go(1)} aria-label="Volgende">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        {/if}
      </div>

      {#if filteredImages.length > 1}
        <div class="thumbnail-strip" bind:this={strip}>
          {#each stripItems as img, j (img.src)}
            {@const index = stripStart + j}
            <button class="strip-thumb {index === currentIndex ? 'active' : ''}" onclick={() => { currentIndex = index; scrollStrip(); }} aria-label="Toon {index + 1}">
              {#if isVideo(img) && img.thumb}
                <img src={img.thumb} alt="" loading="lazy" />
                <div class="video-indicator"><svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></div>
              {:else if isVideo(img)}
                <video src="{img.src}#t=0.5" preload="metadata" muted playsinline></video>
                <div class="video-indicator"><svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></div>
              {:else}
                <img src={img.thumb || img.src} alt="" loading="lazy" />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .gallery-dropdown { margin-top: 1.5rem; }

  .gallery-filter-buttons { display: flex; gap: 1rem; justify-content: center; margin-bottom: 1rem; flex-wrap: wrap; }

  .filter-btn {
    display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem;
    background: white; color: #E8788A; border: 2px solid #E8788A; border-radius: 9999px;
    font-weight: 600; cursor: pointer; transition: all 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  @media (hover: hover) { .filter-btn:hover { background: #FDEEF0; } }
  .filter-btn.active { background: linear-gradient(135deg, #E8788A 0%, #F2A0AA 100%); color: white; border-color: transparent; box-shadow: 0 8px 20px -8px rgba(232, 120, 138, 0.7); }
  .filter-btn .badge { background: rgba(232, 120, 138, 0.15); padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; }
  .filter-btn.active .badge { background: rgba(255, 255, 255, 0.25); color: white; }

  .thumbnails-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; }

  .thumbnail {
    position: relative; aspect-ratio: 1; border-radius: 1rem; overflow: hidden; border: 3px solid #F0E0E2;
    cursor: pointer; padding: 0; transition: all 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    /* soft shimmer while the photo loads */
    background: linear-gradient(110deg, #FDEEF0 30%, #FFF7F8 50%, #FDEEF0 70%) 0 0 / 250% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  .thumbnail.is-loaded { animation: none; background: #FDEEF0; }
  .thumbnail img, .thumbnail video { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 500ms ease, transform 600ms cubic-bezier(0.16, 1, 0.3, 1); }
  .thumbnail.is-loaded img, .thumbnail.is-loaded video { opacity: 1; }
  /* Hover zoom only with a real pointer: on touch it would stick after tapping */
  @media (hover: hover) {
    .thumbnail:not(.blurred):hover { border-color: #E8788A; transform: scale(1.05); z-index: 1; }
    .thumbnail:not(.blurred):hover img { transform: scale(1.06); }
          .show-more-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(232, 120, 138, 0.4); }
    .show-more-btn:hover svg { animation: nudge 800ms ease infinite; }
        }
  .thumbnail:not(.blurred):active { transform: scale(0.96); }
  .thumbnail.reveal { animation: popIn 550ms cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: var(--d); }
  @keyframes popIn { from { opacity: 0; transform: translateY(18px) scale(0.94); } }
  @keyframes shimmer { to { background-position: -250% 0; } }

  /* The row that hints there's more: fades out downwards behind a blur */
  .thumbnail.blurred {
    mask-image: linear-gradient(to bottom, white 0%, white 30%, transparent 70%);
    -webkit-mask-image: linear-gradient(to bottom, white 0%, white 30%, transparent 70%);
    filter: blur(4px);
    opacity: 0.5;
    cursor: pointer;
  }
  .thumbnail.blurred:hover { filter: blur(2px); opacity: 0.7; }

  .thumbnail-video-wrapper { position: relative; width: 100%; height: 100%; }
  .video-play-indicator { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.25); color: white; transition: background 200ms; }
  .thumbnail:hover .video-play-indicator { background: rgba(232, 120, 138, 0.6); }

  .thumbnail-overlay { position: absolute; inset: 0; background: rgba(232, 120, 138, 0.55); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 200ms ease; color: white; }
  .thumbnail:not(.blurred):hover .thumbnail-overlay { opacity: 1; }

  .show-more-container { margin-top: -2rem; display: flex; justify-content: center; position: relative; z-index: 10; }
  .show-more-container.less { margin-top: 1.5rem; }
  .show-more-btn {
    display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #E8788A 0%, #F2A0AA 100%); color: white; border: none; border-radius: 9999px;
    font-weight: 600; cursor: pointer; transition: all 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    box-shadow: 0 4px 15px rgba(232, 120, 138, 0.3);
  }
  .show-more-btn small { opacity: 0.85; font-weight: 500; }
  @keyframes nudge { 50% { transform: translateY(3px); } }

  .no-content { text-align: center; padding: 2rem; color: #888; font-style: italic; }

  /* Lightbox */
  .modal-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(20, 10, 12, 0.95); display: flex; align-items: center; justify-content: center; animation: fadeIn 200ms ease-out; }
  @keyframes fadeIn { from { opacity: 0; } }
  .modal-content { position: relative; width: min(90vw, 1100px); max-height: 92vh; max-height: 92dvh; display: flex; flex-direction: column; align-items: center; }
  .modal-close { position: absolute; top: -3rem; right: 0; background: none; border: none; color: white; cursor: pointer; padding: 0.5rem; opacity: 0.8; }
  .modal-close:hover { opacity: 1; }
  .modal-counter { position: absolute; top: -2.6rem; left: 0; color: white; font-size: 0.875rem; opacity: 0.7; }
  .modal-image-container { position: relative; width: 100%; height: 70vh; display: flex; align-items: center; justify-content: center; }
  .modal-image, .modal-video { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 0.75rem; animation: scaleIn 300ms cubic-bezier(0.16, 1, 0.3, 1); }
  @keyframes scaleIn { from { transform: scale(0.96); opacity: 0; } }
  .nav-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255, 255, 255, 0.12); border: none; color: white; cursor: pointer; padding: 1rem; border-radius: 9999px; transition: background 150ms ease; }
  .nav-btn:hover { background: rgba(232, 120, 138, 0.5); }
  .nav-prev { left: -4.5rem; }
  .nav-next { right: -4.5rem; }
  .thumbnail-strip { display: flex; gap: 0.5rem; margin-top: 1rem; padding: 0.5rem; background: rgba(255, 255, 255, 0.08); border-radius: 0.75rem; max-width: 100%; overflow-x: auto; scrollbar-width: thin; }
  .strip-thumb { position: relative; width: 60px; height: 60px; border-radius: 0.5rem; overflow: hidden; border: 2px solid transparent; cursor: pointer; padding: 0; background: #2a1c1f; opacity: 0.5; transition: all 150ms ease; flex-shrink: 0; }
  .strip-thumb:hover { opacity: 0.85; }
  .strip-thumb.active { border-color: #E8788A; opacity: 1; }
  .strip-thumb img, .strip-thumb video { width: 100%; height: 100%; object-fit: cover; }
  .video-indicator { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.4); color: white; }

  @media (max-width: 768px) {
    .gallery-filter-buttons { gap: 0.6rem; }
    .filter-btn { padding: 0.65rem 1.1rem; }
    .thumbnails-grid { grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
    .thumbnail { border-radius: 0.75rem; border-width: 2px; }

    /* Lightbox fills the phone screen: photo in the middle, controls in the safe areas */
    .modal-content {
      width: 100vw; height: 100dvh; max-height: none; justify-content: center;
      padding: calc(3.75rem + env(safe-area-inset-top, 0px)) 0 calc(0.75rem + env(safe-area-inset-bottom, 0px));
    }
    .modal-close {
      position: absolute; top: calc(0.5rem + env(safe-area-inset-top, 0px)); right: 0.5rem;
      width: 2.75rem; height: 2.75rem; display: grid; place-items: center; opacity: 1;
      border-radius: 999px; background: rgba(255, 255, 255, 0.12);
    }
    .modal-counter { top: calc(1.2rem + env(safe-area-inset-top, 0px)); left: 1rem; }
    .modal-image-container { flex: 1; min-height: 0; height: auto; }
    .modal-image, .modal-video { max-height: 100%; border-radius: 0.5rem; }
    .nav-prev { left: 0.25rem; }
    .nav-next { right: 0.25rem; }
    .nav-btn { padding: 0.6rem; background: rgba(0, 0, 0, 0.35); }
    .thumbnail-strip { max-width: calc(100% - 1rem); flex-shrink: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .thumbnail, .thumbnail.reveal, .modal-image, .modal-video, .modal-overlay { animation: none; }
  }
</style>
