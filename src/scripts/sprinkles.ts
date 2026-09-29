// src/scripts/sprinkles.ts — Interactive 3D cupcake scene (three.js).
//
// Mounts on every <canvas data-cupcakes>. three.js is only downloaded once a
// canvas comes near the viewport, rendering pauses while it is off-screen or the
// tab is hidden, and reduced-motion visitors get a single still frame.
//
// Options (data attributes on the canvas):
//   data-cupcakes="7"   number of floating cupcakes (fewer on small screens)
//   data-hearts="18"    number of small glossy hearts
//   data-seed="7"       layout seed, so every visit looks the same

import { scrollVelocity } from './motion';

type Three = typeof import('three');
type Obj3D = import('three').Object3D;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const WRAPPERS = [0xf2a0aa, 0xffffff, 0xbde0c7, 0xcdb4f5, 0xffd6a5, 0xe8788a];
const FROSTINGS = [0xfff5f7, 0xf7b8c4, 0xffffff, 0xe8788a, 0xf9d7e0, 0x8a5a44];
const SPRINKLES = [0xe8788a, 0xffffff, 0xffd6a5, 0xbde0c7, 0xcdb4f5, 0xd45a6a];
const HEARTS = [0xe8788a, 0xf2a0aa, 0xffffff, 0xd45a6a];

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
  const cupcakeCount = Math.max(3, Math.round(parseInt(canvas.dataset.cupcakes || '7', 10) * (small ? 0.6 : 1)));
  const heartCount = Math.round(parseInt(canvas.dataset.hearts || '18', 10) * (small ? 0.5 : 1));
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

  // ── Shared cupcake geometry ────────────────────────────────────────────
  // Paper wrapper: a lathe (tapered cup) with pleats pushed out radially
  const wrapperProfile = [
    new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.52, 0.0), new THREE.Vector2(0.72, 0.78), new THREE.Vector2(0.7, 0.8),
  ];
  const wrapperGeo = track(new THREE.LatheGeometry(wrapperProfile, 72));
  {
    const pos = wrapperGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = Math.hypot(v.x, v.z);
      if (r < 0.01) continue;
      const a = Math.atan2(v.z, v.x);
      const pleat = 1 + 0.045 * Math.abs(Math.sin(a * 12));
      pos.setXYZ(i, (v.x / r) * r * pleat, v.y, (v.z / r) * r * pleat);
    }
    wrapperGeo.computeVertexNormals();
  }
  // Cake top peeking out of the wrapper
  const cakeGeo = track(new THREE.SphereGeometry(0.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2));
  // Frosting swirl: stacked, shrinking tori + a soft tip
  const swirlGeos = [
    track(new THREE.TorusGeometry(0.5, 0.27, 20, 48)),
    track(new THREE.TorusGeometry(0.34, 0.24, 20, 44)),
    track(new THREE.TorusGeometry(0.18, 0.2, 18, 36)),
  ];
  const tipGeo = track(new THREE.ConeGeometry(0.17, 0.32, 24));
  const cherryGeo = track(new THREE.SphereGeometry(0.15, 24, 16));
  const stemGeo = track(new THREE.CylinderGeometry(0.012, 0.018, 0.28, 6));
  const sprinkleGeo = track(new THREE.CapsuleGeometry(0.018, 0.075, 3, 6));

  const cakeMat = track(new THREE.MeshStandardMaterial({ color: 0xc98b58, roughness: 0.85 }));
  const cherryMat = track(new THREE.MeshPhysicalMaterial({ color: 0xc81e3a, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }));
  const stemMat = track(new THREE.MeshStandardMaterial({ color: 0x5c7a3a, roughness: 0.7 }));
  const sprinkleMat = track(new THREE.MeshStandardMaterial({ roughness: 0.4 }));

  interface Floater { obj: Obj3D; base: import('three').Vector3; phase: number; amp: number; spin: number; tilt: number; scale: number }
  const floaters: Floater[] = [];
  const spread = { x: 10, y: 7 };

  function makeCupcake(i: number): Obj3D {
    const group = new THREE.Group();
    const wrapperMat = track(new THREE.MeshStandardMaterial({ color: WRAPPERS[i % WRAPPERS.length], roughness: 0.55, side: THREE.DoubleSide }));
    const frostMat = track(new THREE.MeshPhysicalMaterial({
      color: FROSTINGS[(i * 2 + 1) % FROSTINGS.length], roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.6, sheenColor: new THREE.Color(0xffffff),
    }));
    const wrapper = new THREE.Mesh(wrapperGeo, wrapperMat);
    const cake = new THREE.Mesh(cakeGeo, cakeMat);
    cake.position.y = 0.72;
    cake.scale.set(1, 0.45, 1);
    group.add(wrapper, cake);

    const levels = [0.95, 1.2, 1.42];
    swirlGeos.forEach((g, l) => {
      const ring = new THREE.Mesh(g, frostMat);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = l * 0.9; // offset seams so it reads as one swirl
      ring.position.y = levels[l];
      group.add(ring);
    });
    const tip = new THREE.Mesh(tipGeo, frostMat);
    tip.position.y = 1.66;
    tip.rotation.z = 0.25;
    group.add(tip);

    // Cherry on most cupcakes, extra sprinkles on the others
    if (i % 3 !== 2) {
      const cherry = new THREE.Mesh(cherryGeo, cherryMat);
      cherry.position.set(0.04, 1.9, 0);
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(0.08, 2.1, 0);
      stem.rotation.z = -0.4;
      group.add(cherry, stem);
    }

    // Sprinkles scattered over the frosting surface
    const n = i % 3 === 2 ? 42 : 26;
    const sprinkles = new THREE.InstancedMesh(sprinkleGeo, sprinkleMat, n);
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    for (let s = 0; s < n; s++) {
      const level = Math.floor(rand() * 3);
      const R = [0.5, 0.34, 0.18][level] + [0.27, 0.24, 0.2][level] * 0.75;
      const a = rand() * Math.PI * 2;
      d.position.set(Math.cos(a) * R, levels[level] + 0.1 + rand() * 0.08, Math.sin(a) * R);
      d.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      d.updateMatrix();
      sprinkles.setMatrixAt(s, d.matrix);
      sprinkles.setColorAt(s, c.setHex(SPRINKLES[s % SPRINKLES.length]));
    }
    group.add(sprinkles);
    track(sprinkles);
    group.position.y = -0.9; // center the cupcake on its pivot
    const pivot = new THREE.Group();
    pivot.add(group);
    return pivot;
  }

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
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -0.35);
  heartShape.bezierCurveTo(-0.05, -0.25, -0.5, 0.0, -0.5, 0.25);
  heartShape.bezierCurveTo(-0.5, 0.5, -0.22, 0.6, 0, 0.38);
  heartShape.bezierCurveTo(0.22, 0.6, 0.5, 0.5, 0.5, 0.25);
  heartShape.bezierCurveTo(0.5, 0.0, 0.05, -0.25, 0, -0.35);
  const heartGeo = track(new THREE.ExtrudeGeometry(heartShape, { depth: 0.16, bevelEnabled: true, bevelSegments: 4, bevelSize: 0.06, bevelThickness: 0.06, curveSegments: 20 }));
  heartGeo.center();
  const heartMat = track(new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const hearts = track(new THREE.InstancedMesh(heartGeo, heartMat, heartCount));
  const heartData = Array.from({ length: heartCount }, (_, i) => {
    hearts.setColorAt(i, new THREE.Color(HEARTS[i % HEARTS.length]));
    return {
      base: new THREE.Vector3((rand() - 0.5) * spread.x * 2.2, (rand() - 0.5) * spread.y * 2, (rand() - 0.5) * 6),
      phase: rand() * Math.PI * 2, amp: 0.2 + rand() * 0.4, spin: 0.3 + rand() * 0.8, scale: 0.35 + rand() * 0.45,
    };
  });
  world.add(hearts);

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
    spinBoost += (Math.min(Math.abs(v) * 0.2, 5) - spinBoost) * 0.08;
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
      f.obj.rotation.y += (f.spin * 0.3 + (f.spin > 0 ? 1 : -1) * spinBoost * 0.15) * dt;
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
      dummy.rotation.set(Math.sin(t * 0.5 + h.phase) * 0.4, t * h.spin * (1 + spinBoost * 0.3) + h.phase, Math.sin(t + h.phase) * 0.2);
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
    timer.dispose();
    renderer.dispose();
  }, { once: true });
}

// Download three.js only when a cupcake canvas is about to be seen
const lazy = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    lazy.unobserve(entry.target);
    mount(entry.target as HTMLCanvasElement).catch((err) => console.warn('[cupcakes] disabled:', err));
  });
}, { rootMargin: '400px' });

document.querySelectorAll<HTMLCanvasElement>('canvas[data-cupcakes]').forEach((c) => lazy.observe(c));
