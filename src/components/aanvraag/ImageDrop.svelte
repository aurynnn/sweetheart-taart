<script lang="ts">
  // ImageDrop.svelte — one example photo per product.
  // Drag & drop, click/tap (opens camera or gallery on phones) or paste.
  // The photo is downsized in the browser before uploading, so phone photos of
  // 5–10 MB become ~300 KB and upload quickly over mobile data.
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  let { key = $bindable(''), preview = $bindable(''), busy = $bindable(false) }: { key?: string; preview?: string; busy?: boolean } = $props();

  const MAX_SIDE = 1600;
  const THUMB_SIDE = 720; // sharp enough for the preview, small enough for the saved draft

  let input: HTMLInputElement;
  let dragging = $state(false);
  let progress = $state(0);
  let error = $state('');
  let dragDepth = 0;

  async function toJpeg(file: File, maxSide: number, quality: number): Promise<Blob> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; // transparent PNGs get a white background instead of black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality));
  }

  const blobToDataUrl = (b: Blob) => new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(b);
  });

  function upload(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', blob, 'voorbeeld.jpg');
      xhr.open('POST', '/api/uploads');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) progress = Math.round((e.loaded / e.total) * 100); };
      xhr.onload = () => {
        let data: any = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300 && data.key) resolve(data.key);
        else reject(new Error(data.error || 'Uploaden mislukt. Probeer het opnieuw.'));
      };
      xhr.onerror = () => reject(new Error('Geen verbinding. Probeer het opnieuw.'));
      xhr.send(form);
    });
  }

  async function handle(file: File | undefined | null) {
    if (!file || busy) return;
    error = '';
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      error = 'Kies een foto (JPG, PNG, WebP of HEIC).';
      return;
    }
    busy = true;
    progress = 0;
    try {
      let full: Blob;
      try {
        full = await toJpeg(file, MAX_SIDE, 0.85);
        preview = await blobToDataUrl(await toJpeg(file, THUMB_SIDE, 0.7));
      } catch {
        throw new Error('Deze foto kan je browser niet openen. Probeer een JPG of PNG.');
      }
      key = await upload(full);
    } catch (e: any) {
      error = e?.message || 'Uploaden mislukt.';
      key = '';
      preview = '';
    } finally {
      busy = false;
    }
  }

  function remove() {
    key = '';
    preview = '';
    error = '';
    if (input) input.value = '';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    dragDepth = 0;
    handle(e.dataTransfer?.files?.[0]);
  }

  onMount(() => {
    // Paste a screenshot or copied image while the editor is open
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (file) { e.preventDefault(); handle(file); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const R = 26;
  const C = 2 * Math.PI * R;
</script>

<div class="drop-wrap">
  {#if preview}
    <div class="preview" in:scale={{ start: 0.9, duration: 350 }}>
      <img src={preview} alt="Jouw voorbeeldfoto" />
      {#if busy}
        <div class="overlay" transition:fade>
          <svg viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="30" r={R} class="track" />
            <circle cx="30" cy="30" r={R} class="bar" style="stroke-dasharray:{C};stroke-dashoffset:{C * (1 - progress / 100)}" />
          </svg>
          <span>{progress}%</span>
        </div>
      {:else}
        <span class="done" in:scale={{ start: 0.4, duration: 400 }} aria-label="Geüpload"><i class="fa-solid fa-check" aria-hidden="true"></i></span>
      {/if}
      <div class="preview-actions">
        <button type="button" onclick={() => input.click()} disabled={busy}><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> Vervangen</button>
        <button type="button" class="danger" onclick={remove} disabled={busy}><i class="fa-solid fa-trash-can" aria-hidden="true"></i> Verwijderen</button>
      </div>
    </div>
  {:else}
    <button
      type="button"
      class="zone"
      class:dragging
      class:busy
      onclick={() => input.click()}
      ondragenter={(e) => { e.preventDefault(); dragDepth++; dragging = true; }}
      ondragover={(e) => e.preventDefault()}
      ondragleave={() => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dragging = false; }}
      ondrop={onDrop}
      aria-describedby="drop-help"
    >
      <span class="zone-icon" aria-hidden="true">
        <i class="fa-solid {dragging ? 'fa-hand-holding-heart' : 'fa-image'}"></i>
      </span>
      <span class="zone-title">{dragging ? 'Laat maar los!' : busy ? 'Foto verwerken…' : 'Voeg een voorbeeldfoto toe'}</span>
      <span class="zone-sub" id="drop-help">
        <span class="desktop">Sleep een foto hierheen, klik om te kiezen of plak met Ctrl+V</span>
        <span class="mobile">Tik om een foto te nemen of uit je galerij te kiezen</span>
      </span>
    </button>
  {/if}
  <input bind:this={input} type="file" accept="image/*" hidden onchange={(e) => handle(e.currentTarget.files?.[0])} />
  {#if error}<p class="error" role="alert" transition:fade>{error}</p>{/if}
</div>

<style>
  .drop-wrap { display: grid; gap: 0.5rem; }
  .zone {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.35rem;
    width: 100%; padding: 1.4rem 1rem; border-radius: 1.1rem; cursor: pointer; font: inherit; color: #4A3A3D; text-align: center;
    background: #fff;
    border: 2px dashed #F0C9CF;
    transition: transform 300ms var(--ease-spring), background 250ms, border-color 250ms, box-shadow 250ms;
  }
  .zone:hover, .zone:focus-visible { border-color: #E8788A; background: #FFF7F8; }
  .zone.dragging { border-style: solid; border-color: #E8788A; background: #FDEEF0; transform: scale(1.02); box-shadow: 0 0 0 6px rgba(232, 120, 138, 0.15); }
  .zone.busy { cursor: progress; opacity: 0.8; }
  .zone-icon { width: 3rem; height: 3rem; border-radius: 50%; display: grid; place-items: center; background: #FDEEF0; color: #E8788A; font-size: 1.25rem; transition: transform 400ms var(--ease-spring); }
  .zone:hover .zone-icon, .zone.dragging .zone-icon { transform: translateY(-4px) rotate(-8deg) scale(1.08); }
  .zone-title { font-weight: 700; font-size: 0.95rem; }
  .zone-sub { font-size: 0.8rem; color: #7A6A6D; }
  .mobile { display: none; }
  @media (hover: none) { .desktop { display: none; } .mobile { display: inline; } }

  .preview { position: relative; border-radius: 1.1rem; overflow: hidden; border: 1.5px solid #F0E0E2; background: #FDEEF0; }
  .preview img { display: block; width: 100%; max-height: 14rem; object-fit: cover; }
  .overlay { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(2px); }
  .overlay svg { width: 4rem; height: 4rem; grid-area: 1 / 1; transform: rotate(-90deg); }
  .overlay span { grid-area: 1 / 1; font-weight: 800; font-size: 0.85rem; color: #D45A6A; }
  .track { fill: none; stroke: #F0E0E2; stroke-width: 5; }
  .bar { fill: none; stroke: #E8788A; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset 200ms ease; }
  .done { position: absolute; top: 0.6rem; right: 0.6rem; width: 2rem; height: 2rem; border-radius: 50%; display: grid; place-items: center; background: #22C55E; color: #fff; box-shadow: 0 6px 14px -4px rgba(34, 197, 94, 0.7); }
  .preview-actions { position: absolute; left: 0.6rem; bottom: 0.6rem; display: flex; gap: 0.4rem; }
  .preview-actions button { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.8rem; border-radius: 999px; border: 0; background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(6px); font: inherit; font-size: 0.8rem; font-weight: 700; color: #4A3A3D; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); }
  .preview-actions button:hover { color: #D45A6A; }
  .preview-actions .danger:hover { color: #DC2626; }
  .error { margin: 0; color: #DC2626; font-size: 0.8rem; font-weight: 600; }
</style>
