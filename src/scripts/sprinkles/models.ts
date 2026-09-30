// Procedural three.js models for the cupcake scene: cupcakes and glossy hearts.
// Geometry and materials are shared where possible and registered with `track`
// so the scene can dispose everything when the page is left.

type Three = typeof import('three');
type Obj3D = import('three').Object3D;
type Track = <T extends { dispose(): void }>(x: T) => T;

const WRAPPERS = [0xf2a0aa, 0xffffff, 0xbde0c7, 0xcdb4f5, 0xffd6a5, 0xe8788a];
const FROSTINGS = [0xfff5f7, 0xf7b8c4, 0xffffff, 0xe8788a, 0xf9d7e0, 0x8a5a44];
const SPRINKLES = [0xe8788a, 0xffffff, 0xffd6a5, 0xbde0c7, 0xcdb4f5, 0xd45a6a];
export const HEART_COLORS = [0xe8788a, 0xf2a0aa, 0xffffff, 0xd45a6a];

/** Returns a function that builds cupcake #i (each centred on its own pivot) */
export function createCupcakeFactory(THREE: Three, rand: () => number, track: Track) {
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

  return function makeCupcake(i: number): Obj3D {
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
  };
}

/** One instanced mesh holding all hearts (a single draw call) */
export function createHearts(THREE: Three, count: number, track: Track) {
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -0.35);
  heartShape.bezierCurveTo(-0.05, -0.25, -0.5, 0.0, -0.5, 0.25);
  heartShape.bezierCurveTo(-0.5, 0.5, -0.22, 0.6, 0, 0.38);
  heartShape.bezierCurveTo(0.22, 0.6, 0.5, 0.5, 0.5, 0.25);
  heartShape.bezierCurveTo(0.5, 0.0, 0.05, -0.25, 0, -0.35);
  const heartGeo = track(new THREE.ExtrudeGeometry(heartShape, { depth: 0.16, bevelEnabled: true, bevelSegments: 4, bevelSize: 0.06, bevelThickness: 0.06, curveSegments: 20 }));
  heartGeo.center();
  const heartMat = track(new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const hearts = track(new THREE.InstancedMesh(heartGeo, heartMat, count));
  for (let i = 0; i < count; i++) hearts.setColorAt(i, new THREE.Color(HEART_COLORS[i % HEART_COLORS.length]));
  return hearts;
}
