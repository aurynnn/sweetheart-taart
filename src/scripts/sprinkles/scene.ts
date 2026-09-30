// Builds and runs one cupcake scene on a canvas: lighting, layout, animation loop,
// pointer/scroll reactions and cleanup.

import { reduceMotion } from '../motion/env';
import { scrollVelocity } from '../motion/smoothScroll';
import { createCupcakeFactory, createHearts } from './models';

type Three = typeof import('three');
type Obj3D = import('three').Object3D;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function mount(canvas: HTMLCanvasElement) {
  const THREE: Three = await import('three');
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

  const small = window.innerWidth < 768;
  const cupcakeCount = Math.max(3, Math.round(parseInt(canvas.dataset.cupcakes || '7', 10) * (small ? 0.6 : 1)));
  const heartCount = Math.round(parseInt(canvas.dataset.hearts || '18', 10) * (small ? 0.5 : 1));
  const rand = rng(parseInt(canvas.dataset.seed || '7', 10));

  let renderer: import('three').WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: small ? 'low-power' : 'high-performance' });
  } catch {
    canvas.remove(); // no WebGL — the section's CSS background carries the design
    return;
  }
  // Phones have dense screens but small GPUs: a lower pixel ratio is barely visible
  // behind the frosted content and roughly halves the fill cost.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xf2a0aa, 1.1));
  const key = new THREE.DirectionalLight(0xfff1e6, 1.8);
  key.position.set(4, 7, 8);
  scene.add(key);
  const rim = new THREE.PointLight(0xe8788a, 40, 30);
  rim.position.set(-6, -3, 5);
  scene.add(rim);

  const world = new THREE.Group();
  scene.add(world);
  const disposables: Array<{ dispose(): void }> = [envTexture];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // ── Cupcakes ──────────────────────────────────────────────────────────
  interface Floater { obj: Obj3D; base: import('three').Vector3; phase: number; amp: number; spin: number; tilt: number; scale: number }
  const floaters: Floater[] = [];
  const spread = { x: 10, y: 7 };
  const makeCupcake = createCupcakeFactory(THREE, rand, track);

  // Place cupcakes spread out, bigger ones further back so they never crowd the copy
  for (let i = 0; i < cupcakeCount; i++) {
    const cupcake = makeCupcake(i);
    const col = (i + 0.5) / cupcakeCount;
    const base = new THREE.Vector3(
      (col - 0.5) * spread.x * 2 + (rand() - 0.5) * 1.5,
      (rand() - 0.5) * spread.y * 1.4,
      -1 - rand() * 4,
    );
    floaters.push({ obj: cupcake, base, phase: rand() * Math.PI * 2, amp: 0.25 + rand() * 0.35, spin: (rand() - 0.5) * 0.6, tilt: (rand() - 0.5) * 0.5, scale: 0.8 + rand() * 0.55 });
    world.add(cupcake);
  }

  // ── Hearts ────────────────────────────────────────────────────────────
  const hearts = createHearts(THREE, heartCount, track);
  const heartData = Array.from({ length: heartCount }, () => ({
    base: new THREE.Vector3((rand() - 0.5) * spread.x * 2.2, (rand() - 0.5) * spread.y * 2, (rand() - 0.5) * 6),
    phase: rand() * Math.PI * 2, amp: 0.2 + rand() * 0.4, spin: 0.25 + rand() * 0.35, scale: 0.35 + rand() * 0.45,
    angle: rand() * Math.PI * 2,
  }));
  world.add(hearts);

  // ── Interaction state ─────────────────────────────────────────────────
  // Mouse/pen only: a finger tap would make the whole scene lurch toward it.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  let spinBoost = 0;
  let scrollDrift = 0;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 1 ? 22 : 16; // keep narrow screens from feeling crowded
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const dummy = new THREE.Object3D();
  const timer = new THREE.Timer();
  timer.connect(document);
  const wrapY = (y: number, range: number) => ((y + range) % (range * 2) + range * 2) % (range * 2) - range;

  const render = () => {
    timer.update();
    const t = timer.getElapsed();
    const dt = Math.min(timer.getDelta(), 1 / 20);

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const v = scrollVelocity || 0;
    // Scrolling adds a gentle, eased extra spin (never a jump)
    spinBoost += (Math.min(Math.abs(v) * 0.05, 1.2) - spinBoost) * 0.04;
    scrollDrift += v * 0.003;

    world.rotation.y = pointer.x * 0.15;
    world.rotation.x = pointer.y * 0.08;
    camera.position.x += (pointer.x * 0.8 - camera.position.x) * 0.05;
    camera.position.y += (-pointer.y * 0.5 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    for (const f of floaters) {
      f.obj.position.set(
        f.base.x + Math.cos(t * 0.3 + f.phase) * f.amp * 0.6,
        wrapY(f.base.y + Math.sin(t * 0.6 + f.phase) * f.amp + scrollDrift * 0.6, spread.y),
        f.base.z,
      );
      f.obj.rotation.y += (f.spin * 0.3 + (f.spin > 0 ? 1 : -1) * spinBoost * 0.12) * dt;
      f.obj.rotation.z = f.tilt + Math.sin(t * 0.8 + f.phase) * 0.08 - pointer.x * 0.1;
      f.obj.rotation.x = 0.25 + Math.cos(t * 0.5 + f.phase) * 0.08 + pointer.y * 0.1;
      f.obj.scale.setScalar(f.scale);
    }

    heartData.forEach((h, i) => {
      dummy.position.set(
        h.base.x + Math.sin(t * 0.4 + h.phase) * h.amp,
        wrapY(h.base.y + Math.sin(t * 0.7 + h.phase) * h.amp + scrollDrift * (0.8 + h.amp), spread.y * 1.1),
        h.base.z,
      );
      // Accumulate the angle per frame: multiplying elapsed time by a changing speed made hearts whirl
      h.angle += h.spin * (1 + spinBoost) * dt;
      dummy.rotation.set(Math.sin(t * 0.5 + h.phase) * 0.4, h.angle, Math.sin(t + h.phase) * 0.2);
      // gentle heartbeat
      dummy.scale.setScalar(h.scale * (1 + Math.max(0, Math.sin(t * 2.4 + h.phase)) ** 8 * 0.18));
      dummy.updateMatrix();
      hearts.setMatrixAt(i, dummy.matrix);
    });
    hearts.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  };

  if (reduceMotion) {
    render();
    canvas.classList.add('is-ready');
    return;
  }

  // Phones render at ~30 fps: the motion is slow and floaty, so it looks the same
  // while using half the battery and leaving the main thread free for scrolling.
  const frameInterval = small ? 1000 / 30 : 0;
  let lastFrame = 0;
  let visible = false;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) timer.reset(); // don't jump after a pause
  }, { rootMargin: '100px' });
  io.observe(canvas);
  renderer.setAnimationLoop((now) => {
    if (!visible || document.hidden) return;
    if (frameInterval && now - lastFrame < frameInterval - 2) return;
    lastFrame = now;
    render();
  });
  requestAnimationFrame(() => canvas.classList.add('is-ready'));

  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', onPointer);
    disposables.forEach((d) => d.dispose());
    timer.dispose();
    renderer.dispose();
  }, { once: true });
}
