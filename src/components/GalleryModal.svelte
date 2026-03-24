<script>
// GalleryModal.svelte
// Modern modal gallery with thumbnails - supports both images and videos

let { images = [], rowsToShow = 2, rowsToAdd = 10, minItemsPerRow = 10 } = $props();

let isOpen = $state(false);
let currentIndex = $state(0);
let visibleRows = $state(rowsToShow + 1); // Start with 2 full rows + 3rd row (with blur)
let activeFilter = $state('image'); // 'image' or 'video'

// Filter images based on activeFilter
let filteredImages = $derived(
  activeFilter === 'video' ? images.filter(img => isVideo(img)) :
  images.filter(img => !isVideo(img))
);

// Count images and videos
let imageCount = $derived(images.filter(img => !isVideo(img)).length);
let videoCount = $derived(images.filter(img => isVideo(img)).length);

// Calculate visible count based on rows
// First 2 rows (20 items) are always clear
// Row 3 (10 items, indices 20-29) is blurred on bottom half
let fullRowsVisible = $derived(rowsToShow * minItemsPerRow); // 20 items (2 full rows)
let currentVisibleCount = $derived(visibleRows * minItemsPerRow); // 30 items (3 rows)
let hasMore = $derived(filteredImages.length > currentVisibleCount);

function openGallery(index = 0) {
  currentIndex = index;
  isOpen = true;
  document.body.style.overflow = 'hidden';
}

function closeGallery() {
  isOpen = false;
  document.body.style.overflow = '';
}

function nextImage() {
  currentIndex = (currentIndex + 1) % filteredImages.length;
}

function prevImage() {
  currentIndex = (currentIndex - 1 + filteredImages.length) % filteredImages.length;
}

function showMoreRows() {
  visibleRows += rowsToAdd;
}

function showLess() {
  visibleRows = rowsToShow + 1; // Back to 2 full rows + half of 3rd
}

function handleKeydown(e) {
  if (!isOpen) return;
  if (e.key === 'Escape') closeGallery();
  if (e.key === 'ArrowRight') nextImage();
  if (e.key === 'ArrowLeft') prevImage();
}

function isVideo(item) {
  return item.type === 'video' || (item.src && (item.src.endsWith('.mp4') || item.src.endsWith('.webm') || item.src.endsWith('.mov')));
}

function getVideoThumbnail(item) {
  // Use provided thumbnail, or use R2 public URL for video thumbnail
  if (item.thumbnail) return item.thumbnail;
  // For R2 videos, construct thumbnail URL from video URL
  if (item.src && item.src.includes('r2.dev')) {
    // Cloudflare R2 video - no automatic thumbnail, use placeholder
    return null;
  }
  return item.thumbnail || item.src;
}

// Compute partial row info for blur
// Always blur the LAST ROW of current view (whether partial or complete)
let shouldBlur = $derived({
  enabled: hasMore,
  lastRowStart: currentVisibleCount - minItemsPerRow,
  isPartial: (currentVisibleCount % minItemsPerRow) > 0
});

function getItemStyle(index) {
  // Returns empty - blur is handled by CSS class
  return '';
}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Filter Buttons -->
<div class="gallery-filter-buttons">
  <button 
    class="filter-btn {activeFilter === 'image' ? 'active' : ''}"
    onclick={() => { activeFilter = 'image'; showAll = false; }}
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
    <span>Foto's</span>
    <span class="badge">{imageCount}</span>
  </button>
  
  <button 
    class="filter-btn {activeFilter === 'video' ? 'active' : ''}"
    onclick={() => { activeFilter = 'video'; showAll = false; }}
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
    <span>Video's</span>
    <span class="badge">{videoCount}</span>
  </button>
</div>

<!-- Thumbnails Grid -->
{#if filteredImages.length > 0}
<div class="gallery-dropdown">
  <div class="thumbnails-grid">
    {#each filteredImages.slice(0, currentVisibleCount) as img, i}
      <button 
        class="thumbnail {(shouldBlur.enabled && i >= shouldBlur.lastRowStart) ? 'blurred' : ''}"
        onclick={() => openGallery(i)}
        style={getItemStyle(i)}
      >
        {#if isVideo(img)}
          <div class="thumbnail-video-wrapper">
            {#if getVideoThumbnail(img)}
              <img 
                src={getVideoThumbnail(img)} 
                alt={img.alt || 'Video thumbnail'} 
                loading="lazy" 
                class="thumbnail-video-img"
              />
            {:else}
              <div class="video-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              </div>
            {/if}
            <div class="video-play-indicator">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        {:else}
          <img src={img.src} alt={img.alt} loading="lazy" />
          <div class="thumbnail-overlay">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        {/if}
      </button>
    {/each}
  </div>
  
  <!-- Show More Button -->
  {#if hasMore}
    <div class="show-more-container">
      <button class="show-more-btn" onclick={showMoreRows}>
        <span>Toon meer ({filteredImages.length - currentVisibleCount} remaining)</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  {:else if visibleRows > rowsToShow + 1}
    <div class="show-more-container">
      <button class="show-more-btn" onclick={showLess}>
        <span>Toon minder</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
    </div>
  {:else if filteredImages.length === 0}
    <p class="no-content">Geen {activeFilter === 'video' ? "video's" : "foto's"} beschikbaar</p>
  {/if}
</div>
{/if}

<!-- Modal -->
{#if isOpen}
  <div class="modal-overlay" onclick={closeGallery} role="dialog" aria-modal="true">
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <!-- Close button -->
      <button class="modal-close" onclick={closeGallery}>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Counter -->
      <div class="modal-counter">
        {currentIndex + 1} / {filteredImages.length}
      </div>

      <!-- Main image/video -->
      <div class="modal-image-container">
        {#if isVideo(filteredImages[currentIndex])}
          <video 
            src={filteredImages[currentIndex].src} 
            controls 
            autoplay
            class="modal-video"
          >
            <track kind="captions" />
          </video>
        {:else}
          <img 
            src={filteredImages[currentIndex].src} 
            alt={filteredImages[currentIndex].alt}
            class="modal-image"
          />
        {/if}
        
        <!-- Navigation arrows -->
        {#if filteredImages.length > 1}
          <button class="nav-btn nav-prev" onclick={(e) => { e.stopPropagation(); prevImage(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          
          <button class="nav-btn nav-next" onclick={(e) => { e.stopPropagation(); nextImage(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        {/if}
      </div>

      <!-- Caption -->
      {#if filteredImages[currentIndex].caption}
        <p class="modal-caption">{filteredImages[currentIndex].caption}</p>
      {/if}

      <!-- Thumbnail strip -->
      {#if images.length > 1}
        <div class="thumbnail-strip">
          {#each images as img, i}
            <button 
              class="strip-thumb {i === currentIndex ? 'active' : ''}"
              onclick={() => currentIndex = i}
            >
              {#if isVideo(img)}
                <img src={img.thumbnail || '/images/video-placeholder.jpg'} alt={img.alt} loading="lazy" />
                <div class="video-indicator">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              {:else}
                <img src={img.src} alt={img.alt} loading="lazy" />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}


<style>
  .gallery-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #E8788A 0%, #F2A0AA 100%);
    color: white;
    border: none;
    border-radius: 9999px;
    font-weight: 600;
    cursor: pointer;
    transition: all 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    box-shadow: 0 4px 15px rgba(232, 120, 138, 0.4);
  }

  .gallery-trigger:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(232, 120, 138, 0.5);
  }

  .gallery-trigger .badge {
    background: rgba(255, 255, 255, 0.25);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
  }

  .gallery-dropdown {
    margin-top: 1.5rem;
  }

  .gallery-filter-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: white;
    color: #E8788A;
    border: 2px solid #E8788A;
    border-radius: 9999px;
    font-weight: 600;
    cursor: pointer;
    transition: all 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .filter-btn:hover {
    background: #FDEEF0;
  }

  .filter-btn.active {
    background: linear-gradient(135deg, #E8788A 0%, #F2A0AA 100%);
    color: white;
    border-color: transparent;
  }

  .filter-btn .badge {
    background: rgba(232, 120, 138, 0.15);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
  }

  .filter-btn.active .badge {
    background: rgba(255, 255, 255, 0.25);
    color: white;
  }

  .thumbnails-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 1rem;
  }

  .thumbnail-video-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .thumbnail-video-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-play-indicator {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    color: white;
  }

  .video-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #E8788A 0%, #F2A0AA 100%);
    color: white;
  }

  .thumbnail:hover .video-play-indicator {
    background: rgba(232, 120, 138, 0.6);
  }

  .show-more-container {
    margin-top: -2rem;
    display: flex;
    justify-content: center;
    position: relative;
    z-index: 10;
  }

  .show-more-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #E8788A 0%, #F2A0AA 100%);
    color: white;
    border: none;
    border-radius: 9999px;
    font-weight: 600;
    cursor: pointer;
    transition: all 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    box-shadow: 0 4px 15px rgba(232, 120, 138, 0.3);
  }

  .show-more-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(232, 120, 138, 0.4);
  }

  .no-content {
    text-align: center;
    padding: 2rem;
    color: #888;
    font-style: italic;
  }

  .thumbnail {
    position: relative;
    aspect-ratio: 1;
    border-radius: 1rem;
    overflow: hidden;
    border: 3px solid #F0E0E2;
    cursor: pointer;
    transition: all 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    padding: 0;
    background: none;
  }

  .thumbnail:hover {
    border-color: #E8788A;
    transform: scale(1.05);
  }

  .thumbnail.blurred {
    mask-image: linear-gradient(to bottom, white 0%, white 30%, transparent 70%);
    -webkit-mask-image: linear-gradient(to bottom, white 0%, white 30%, transparent 70%);
    filter: blur(4px);
    opacity: 0.5;
    cursor: default;
  }

  .thumbnail.blurred:hover {
    filter: blur(2px);
    opacity: 0.7;
  }

  .thumbnail:not(.blurred):hover {
    border-color: #E8788A;
    transform: scale(1.05);
  }

  .thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-overlay {
    position: absolute;
    inset: 0;
    background: rgba(232, 120, 138, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 150ms ease;
    color: white;
  }

  .thumbnail:hover .thumbnail-overlay {
    opacity: 1;
  }

  .video-overlay {
    background: rgba(0, 0, 0, 0.6);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 200ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .modal-close {
    position: absolute;
    top: -3rem;
    right: 0;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.5rem;
    opacity: 0.7;
    transition: opacity 150ms ease;
  }

  .modal-close:hover {
    opacity: 1;
  }

  .modal-counter {
    position: absolute;
    top: -3rem;
    left: 0;
    color: white;
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .modal-image-container {
    position: relative;
    max-height: 70vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-image,
  .modal-video {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 0.5rem;
    animation: scaleIn 200ms ease-out;
  }

  .modal-video {
    width: 100%;
    max-width: 90vw;
  }

  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    cursor: pointer;
    padding: 1rem;
    border-radius: 9999px;
    transition: all 150ms ease;
  }

  .nav-btn:hover {
    background: rgba(232, 120, 138, 0.4);
  }

  .nav-prev {
    left: -4rem;
  }

  .nav-next {
    right: -4rem;
  }

  .modal-caption {
    color: white;
    margin-top: 1rem;
    text-align: center;
    opacity: 0.8;
  }

  .thumbnail-strip {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    max-width: 100%;
    overflow-x: auto;
  }

  .strip-thumb {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 0.375rem;
    overflow: hidden;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    background: none;
    opacity: 0.5;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .strip-thumb:hover {
    opacity: 0.8;
  }

  .strip-thumb.active {
    border-color: #E8788A;
    opacity: 1;
  }

  .strip-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-indicator {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    color: white;
  }

  @media (max-width: 768px) {
    .nav-prev {
      left: 0.5rem;
    }
    
    .nav-next {
      right: 0.5rem;
    }
    
    .thumbnails-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>

