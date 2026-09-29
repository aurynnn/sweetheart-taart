// src/scripts/sprinkles.ts — Interactive 3D sprinkle field (three.js).
//
// Mounts on every <canvas data-sprinkles>. three.js is only downloaded once a
// canvas comes near the viewport, rendering pauses while it is off-screen or the
// tab is hidden, and reduced-motion visitors get a single still frame.
//
// Options (data attributes on the canvas):
//   data-sprinkles="72"      number of sprinkles (halved on small screens)
//   data-donuts="3"          number of glazed donuts
//   data-pearls="40"         number of sugar pearls

import { scrollVelocity } from './motion';

type Three = typeof import('three');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PALETTE = ['#E8788A', '#F2A0AA', '#FFFFFF', '#FFD6A5', '#BDE0C7', '#CDB4F5', '#D45A6A', '#FFC8DD'];

// Tiny deterministic PRNG so every visit looks the same (no layout "jump" between loads)
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

async function mount(canvas: HTMLCanvasElement) {
  const THREE: Three = await import('three');
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

  const small = window.innerWidth < 768;
  const count = Math.round(parseInt(canvas.dataset.sprinkles || '72', 10) * (small ? 0.5 : 1));
  const pearlCount = Math.round(parseInt(canvas.dataset.pearls || '40', 10) * (small ? 0.5 : 1));
  const donutCount = parseInt(canvas.dataset.donuts || '3', 10);
  const rand = rng(parseInt(canvas.dataset.seed || '7', 10));

  let renderer: import('three').WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'high-performance' });
  } catch {
    canvas.remove(); // no WebGL — the section's CSS background carries the design
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  // Soft studio reflections without loading any texture files
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xf2a0aa, 1.1));
  const key = new THREE.DirectionalLight(0xfff1e6, 1.6);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new THREE.PointLight(0xe8788a, 30, 30);
  rim.position.set(-6, -3, 4);
  scene.add(rim);

  const world = new THREE.Group();
  scene.add(world);

  const disposables: Array<{ dispose(): void }> = [envTexture];
  const spread = { x: 11, y: 7, z: 6 };

  // ── Sprinkles (instanced capsules) ────────────────────────────────────
  const sprinkleGeo = new THREE.CapsuleGeometry(0.07, 0.38, 4, 10);
  const sprinkleMat = new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 });
  const sprinkles = new THREE.InstancedMesh(sprinkleGeo, sprinkleMat, count);
  disposables.push(sprinkleGeo, sprinkleMat);

  // ── Sugar pearls ──────────────────────────────────────────────────────
  const pearlGeo = new THREE.SphereGeometry(0.13, 20, 14);
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff7f2, roughness: 0.18, metalness: 0.35, iridescence: 0.6, iridescenceIOR: 1.4, clearcoat: 1,
  });
  const pearls = new THREE.InstancedMesh(pearlGeo, pearlMat, pearlCount);
  disposables.push(pearlGeo, pearlMat);

  interface Particle { base: import('three').Vector3; rot: import('three').Euler; spin: import('three').Vector3; phase: number; amp: number; scale: number }
  const makeParticles = (n: number, scaleRange: [number, number]): Particle[] =>
    Array.from({ length: n }, () => ({
      base: new THREE.Vector3((rand() - 0.5) * spread.x * 2, (rand() - 0.5) * spread.y * 2, (rand() - 0.5) * spread.z * 2 - 1),
      rot: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
      spin: new THREE.Vector3((rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8),
      phase: rand() * Math.PI * 2,
      amp: 0.15 + rand() * 0.45,
      scale: scaleRange[0] + rand() * (scaleRange[1] - scaleRange[0]),
    }));

  const sprinkleData = makeParticles(count, [0.8, 1.35]);
  const pearlData = makeParticles(pearlCount, [0.6, 1.4]);
  const color = new THREE.Color();
  sprinkleData.forEach((_, i) => sprinkles.setColorAt(i, color.set(PALETTE[i % PALETTE.length])));
  world.add(sprinkles, pearls);

  // ── Glazed donuts (hero objects) ──────────────────────────────────────
  const donuts: Array<{ mesh: import('three').Group; data: Particle }> = [];
  const doughGeo = new THREE.TorusGeometry(0.62, 0.3, 28, 64);
  const glazeGeo = new THREE.TorusGeometry(0.63, 0.24, 28, 64);
  const doughMat = new THREE.MeshStandardMaterial({ color: 0xe9b77f, roughness: 0.75 });
  disposables.push(doughGeo, glazeGeo, doughMat);
  for (let i = 0; i < donutCount; i++) {
    const glazeMat = new THREE.MeshPhysicalMaterial({
      color: [0xf2a0aa, 0xffffff, 0xe8788a][i % 3], roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4,
    });
    disposables.push(glazeMat);
    const group = new THREE.Group();
    const dough = new THREE.Mesh(doughGeo, doughMat);
    const glaze = new THREE.Mesh(glazeGeo, glazeMat);
    glaze.position.z = 0.1;
    glaze.scale.set(1, 1, 0.85);
    group.add(dough, glaze);
    const data = makeParticles(1, [0.9, 1.3])[0];
    data.base.set((i - (donutCount - 1) / 2) * (small ? 3 : 5.5) + (rand() - 0.5), (rand() - 0.5) * 3, 1 + rand() * 2);
    donuts.push({ mesh: group, data });
    world.add(group);
  }

  // ── Interaction state ─────────────────────────────────────────────────
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => {
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
    // Keep the field filling narrow (portrait) screens too
    camera.position.z = w / h < 1 ? 18 : 14;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const dummy = new THREE.Object3D();
  const timer = new THREE.Timer();
  timer.connect(document); // pauses cleanly while the tab is hidden

  const writeInstances = (mesh: import('three').InstancedMesh, data: Particle[], t: number, dt: number) => {
    data.forEach((p, i) => {
      p.rot.x += p.spin.x * dt * (1 + spinBoost);
      p.rot.y += p.spin.y * dt * (1 + spinBoost);
      p.rot.z += p.spin.z * dt * (1 + spinBoost);
      // wrap vertically so the scroll drift never empties the scene
      let y = p.base.y + Math.sin(t * 0.6 + p.phase) * p.amp + scrollDrift * (0.4 + p.amp);
      y = ((y + spread.y) % (spread.y * 2) + spread.y * 2) % (spread.y * 2) - spread.y;
      dummy.position.set(p.base.x + Math.cos(t * 0.4 + p.phase) * p.amp * 0.6, y, p.base.z);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  const render = () => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 1 / 20);
    const t = timer.getElapsed();

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const v = scrollVelocity || 0;
    spinBoost += (Math.min(Math.abs(v) * 0.25, 6) - spinBoost) * 0.08;
    scrollDrift += v * 0.004;

    world.rotation.y = pointer.x * 0.18;
    world.rotation.x = pointer.y * 0.12;
    camera.position.x += (pointer.x * 0.8 - camera.position.x) * 0.05;
    camera.position.y += (-pointer.y * 0.5 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    writeInstances(sprinkles, sprinkleData, t, dt);
    writeInstances(pearls, pearlData, t, dt);
    donuts.forEach(({ mesh, data }, i) => {
      mesh.position.set(
        data.base.x + pointer.x * (0.6 + i * 0.2),
        data.base.y + Math.sin(t * 0.8 + data.phase) * 0.35 - pointer.y * 0.3,
        data.base.z,
      );
      mesh.rotation.x = 0.9 + Math.sin(t * 0.5 + data.phase) * 0.25 + spinBoost * 0.05;
      mesh.rotation.y = t * 0.35 * (i % 2 ? -1 : 1) + data.phase;
      mesh.scale.setScalar(data.scale);
    });

    renderer.render(scene, camera);
  };

  if (reduceMotion) {
    render();
    canvas.classList.add('is-ready');
    return;
  }

  // Only animate while visible and the tab is active
  let visible = false;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) timer.reset(); // don't jump after a pause
  }, { rootMargin: '100px' });
  io.observe(canvas);
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    render();
  });
  requestAnimationFrame(() => canvas.classList.add('is-ready'));

  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', onPointer);
    disposables.forEach((d) => d.dispose());
    sprinkles.dispose();
    pearls.dispose();
    timer.dispose();
    renderer.dispose();
  }, { once: true });
}

// Download three.js only when a sprinkle canvas is about to be seen
const lazy = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    lazy.unobserve(entry.target);
    mount(entry.target as HTMLCanvasElement).catch((err) => console.warn('[sprinkles] disabled:', err));
  });
}, { rootMargin: '400px' });

document.querySelectorAll<HTMLCanvasElement>('canvas[data-sprinkles]').forEach((c) => lazy.observe(c));
