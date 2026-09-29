<!-- CSS injected by the component itself: Astro 7 (Rolldown) drops the CSS of components that are not in the server-rendered HTML -->
<svelte:options css="injected" />
<script lang="ts">
  // Confetti.svelte — one celebratory burst of pastel confetti on mount.
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;
  const COLORS = ['#E8788A', '#F2A0AA', '#FFD6A5', '#BDE0C7', '#CDB4F5', '#FFFFFF', '#D45A6A'];

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;
    const pieces = Array.from({ length: window.innerWidth < 640 ? 110 : 200 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 50;
      const speed = (14 + Math.random() * 16) * dpr;
      return {
        x: fromLeft ? 0 : W(),
        y: H() * 0.75,
        vx: Math.cos((angle * Math.PI) / 180) * speed,
        vy: Math.sin((angle * Math.PI) / 180) * speed,
        w: (6 + Math.random() * 6) * dpr,
        h: (10 + Math.random() * 8) * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[i % COLORS.length],
        round: Math.random() < 0.3,
      };
    });

    let frame = 0;
    let raf = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, W(), H());
      let alive = 0;
      for (const p of pieces) {
        p.vy += 0.35 * dpr;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y < H() + 40) alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - frame / 260);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 2);
        }
        ctx.restore();
      }
      if (alive && frame < 260) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  });
</script>

<canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>

<style>
  .confetti { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 90; }
</style>
