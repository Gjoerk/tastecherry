// "Cherry on top", literally: a real (lit, physically based) round layer cake
// for the free space under "That's where I come in." Two sponge layers with
// cream and a line of cherry jam show where a slice is cut out; buttercream
// with soft palette-knife ridges, a ring of piped star-tip rosettes and a
// glossy cherry on its stem in the middle, on a white ceramic plate. Drag to
// rotate; slow idle spin. The cherry is the section's one accent-red thing.

import * as THREE from "three";
import { createStage, dragRotate, studioEnvironment } from "./stage.js";

const H = 0.95;                          // cake height (radius 1)
const WEDGE = THREE.MathUtils.degToRad(40);   // the missing slice

// ---------------------------------------------------------------- noise
const hash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t) => t * t * (3 - 2 * t);
function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const l = THREE.MathUtils.lerp, c = (a, b, d) => hash(xi + a, yi + b, zi + d);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf) * 2 - 1;
}

// ---------------------------------------------------------------- textures
// The cut face, bottom to top: sponge, cream, cherry jam, sponge, cream top,
// with the buttercream coat along the outside edge. Colour + a bump map.
function layersTexture(size = 1024) {
  const make = () => { const c = document.createElement("canvas"); c.width = c.height = size; return c; };
  const colour = make(), bump = make();
  const g = colour.getContext("2d"), b = bump.getContext("2d");
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const Y = (v) => size * (1 - v / H);           // cake height → canvas y
  const X = (u) => size * u;                     // radius 0..1 → canvas x

  // bands (heights in cake units); wavy edges so nothing is ruler-straight
  const band = (y0, y1, fill, bumpGrey) => {
    for (const [ctx, style] of [[g, fill], [b, bumpGrey]]) {
      ctx.fillStyle = style;
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) ctx.lineTo(X(i / 64), Y(y0 + noise(i * 0.4, y0 * 9, 1) * 0.008));
      for (let i = 64; i >= 0; i--) ctx.lineTo(X(i / 64), Y(y1 + noise(i * 0.4, y1 * 9, 2) * 0.008));
      ctx.fill();
    }
  };
  band(0, 0.38, "#E3C07E", "#8a8a8a");           // sponge
  band(0.38, 0.45, "#F3E6D0", "#b0b0b0");        // cream
  band(0.44, 0.5, "#7E0B20", "#6a6a6a");         // cherry jam
  band(0.495, 0.86, "#E6C584", "#8a8a8a");       // sponge
  band(0.86, H, "#F3E6D0", "#b4b4b4");           // cream top

  // crumb: pores and lighter specks in the sponge bands
  for (const [y0, y1] of [[0.01, 0.375], [0.505, 0.855]]) {
    for (let i = 0; i < 5200; i++) {
      const x = X(rnd() * 0.95), y = Y(y0 + rnd() * (y1 - y0));
      const r = 0.6 + rnd() * rnd() * 5;
      const dark = rnd() < 0.7;
      g.fillStyle = dark ? `rgba(160,110,50,${0.25 + rnd() * 0.3})` : `rgba(255,240,200,${0.3 + rnd() * 0.3})`;
      g.beginPath(); g.ellipse(x, y, r * (0.8 + rnd() * 0.6), r * (0.6 + rnd() * 0.5), rnd() * 3, 0, 7); g.fill();
      b.fillStyle = dark ? "rgba(20,20,20,0.6)" : "rgba(230,230,230,0.5)";
      b.beginPath(); b.ellipse(x, y, r, r * 0.8, 0, 0, 7); b.fill();
    }
  }
  // the buttercream coat along the outside of the cake
  for (const [ctx, style] of [[g, "#F1E4CF"], [b, "#b4b4b4"]]) {
    ctx.fillStyle = style;
    ctx.beginPath();
    ctx.moveTo(X(1), Y(0));
    for (let i = 0; i <= 64; i++) { const v = (i / 64) * H; ctx.lineTo(X(0.955 + noise(v * 12, 3, 3) * 0.008), Y(v)); }
    ctx.lineTo(X(1), Y(H));
    ctx.fill();
  }
  const tex = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(colour, true), bumpMap: tex(bump, false) };
}

// ---------------------------------------------------------------- geometry
// Outline of the cake (r, y): flat bottom, straight side, rounded shoulder, flat top
function cakeProfile() {
  const pts = [];
  for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector2((i / 6) * 0.97, 0));
  for (let i = 1; i <= 36; i++) pts.push(new THREE.Vector2(1, 0.03 + (i / 36) * (H - 0.13)));
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    pts.push(new THREE.Vector2(0.9 + 0.1 * Math.cos(a), H - 0.1 + 0.1 * Math.sin(a)));
  }
  for (let i = 1; i <= 16; i++) pts.push(new THREE.Vector2(0.9 * (1 - i / 16) + 0.0001, H));
  return pts;
}

function cakeBody() {
  const profile = cakeProfile();
  const geo = new THREE.LatheGeometry(profile, 180, WEDGE / 2, Math.PI * 2 - WEDGE);
  // buttercream: soft lumps and horizontal palette-knife ridges, fading to
  // nothing at the cut so the faces meet the coat exactly
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 0.02) continue;
    let phi = Math.atan2(v.x, v.z);
    if (phi < 0) phi += Math.PI * 2;
    const edge = Math.min(phi - WEDGE / 2, Math.PI * 2 - WEDGE / 2 - phi);
    const fade = smooth(Math.min(1, Math.max(0, edge / 0.12)));
    const side = v.y > 0.02 && v.y < H - 0.02 ? 1 : 0.4;
    const bump = (noise(v.x * 5, v.y * 5, v.z * 5) * 0.006 + Math.sin(v.y * 48 + noise(v.x * 3, 1, v.z * 3) * 3) * 0.0018 * side) * fade;
    if (v.y > H - 0.005) v.y += bump * 0.8;                 // top: gentle swirls
    else { v.x += (v.x / r) * bump; v.z += (v.z / r) * bump; }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// One cut face: the profile as a flat shape, UVs (r, y/H) into the layers texture
function cutFace(angle) {
  const shape = new THREE.Shape(cakeProfile().concat([new THREE.Vector2(0, H)]));
  const geo = new THREE.ShapeGeometry(shape, 24);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i) / H);
  geo.rotateY(angle - Math.PI / 2);            // +x (the radius) → the lathe's direction at `angle`
  return geo;
}

// A piped star-tip rosette: a dollop with eight twisted ridges
function rosette() {
  const profile = [[0, 0], [0.11, 0.004], [0.125, 0.04], [0.105, 0.085], [0.07, 0.12], [0.035, 0.15], [0.008, 0.172], [0, 0.175]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve(profile).getSpacedPoints(40), 72);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const phi = Math.atan2(v.x, v.z);
    const k = 1 + 0.2 * Math.cos(8 * phi + v.y * 32) * Math.min(1, v.y / 0.03);
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// A cherry: slightly squashed, with the dimple where the stem goes in
function cherryGeometry(R = 0.16) {
  const geo = new THREE.SphereGeometry(R, 96, 64);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const up = v.y / R;
    const dimple = Math.exp(-Math.pow((1 - up) / 0.12, 2)) * 0.28 * R;
    const cleft = Math.exp(-Math.pow(Math.atan2(v.x, v.z) / 0.25, 2)) * 0.03 * R;  // the faint seam
    v.multiplyScalar(1 - cleft / R);
    v.y = v.y * 0.92 - dimple;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function plateGeometry() {
  const p = [[0, -0.07], [0.72, -0.07], [0.78, -0.045], [1.22, -0.02], [1.36, 0.02], [1.4, 0.035], [1.37, 0.045], [1.26, 0.012], [1.1, 0.0], [0, 0.0]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(new THREE.SplineCurve(p).getSpacedPoints(80), 160);
}

function contactShadow(opacity = 0.3) {
  const size = 256, c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d"), grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(15,15,14,${opacity})`);
  grad.addColorStop(0.55, `rgba(15,15,14,${opacity * 0.5})`);
  grad.addColorStop(1, "rgba(15,15,14,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// ---------------------------------------------------------------- the cake
export function createCake() {
  const cake = new THREE.Group();
  const shadowy = (m) => { m.castShadow = m.receiveShadow = true; return m; };

  const cream = new THREE.MeshPhysicalMaterial({
    color: "#F1E4CF", roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color("#FFF3E0"), sheenRoughness: 0.45,
  });
  cake.add(shadowy(new THREE.Mesh(cakeBody(), cream)));

  const layers = layersTexture();
  const inside = new THREE.MeshStandardMaterial({ ...layers, bumpScale: 1.4, roughness: 0.85, side: THREE.DoubleSide });
  for (const a of [WEDGE / 2, -WEDGE / 2]) cake.add(shadowy(new THREE.Mesh(cutFace(a), inside)));

  // rosettes round the top edge, not where the slice is gone
  const dollop = rosette();
  const n = 14;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.PI / n;
    const gap = Math.min(Math.abs(a), Math.abs(Math.PI * 2 - a));
    if (gap < WEDGE / 2 + 0.2) continue;
    const m = shadowy(new THREE.Mesh(dollop, cream));
    m.position.set(0.8 * Math.sin(a), H - 0.01, 0.8 * Math.cos(a));
    m.rotation.y = k * 1.3;
    m.scale.setScalar(0.95 + ((k * 37) % 10) / 100);
    cake.add(m);
  }

  // the cherry on a bigger dollop in the middle
  const base = shadowy(new THREE.Mesh(dollop, cream));
  base.scale.set(1.35, 1.1, 1.35);
  base.position.set(0, H - 0.01, 0);
  cake.add(base);
  const cherry = shadowy(new THREE.Mesh(cherryGeometry(), new THREE.MeshPhysicalMaterial({
    color: "#8E0A22", roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04,
    sheen: 0.4, sheenColor: new THREE.Color("#FF3355"), sheenRoughness: 0.4,
  })));
  cherry.position.set(0, H + 0.3, 0.02);
  cherry.rotation.set(0.12, 0.4, -0.08);
  cake.add(cherry);
  const stem = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, H + 0.41, 0.03), new THREE.Vector3(0.02, H + 0.52, 0.04),
    new THREE.Vector3(0.08, H + 0.64, 0.05), new THREE.Vector3(0.18, H + 0.72, 0.04),
  ]);
  const stemGeo = new THREE.TubeGeometry(stem, 48, 0.011, 10);
  const sp = stemGeo.attributes.position;                       // taper toward the tip
  for (let i = 0; i < sp.count; i++) {
    const t = Math.floor(i / 11) / 48, c = stem.getPointAt(Math.min(t, 1));
    const k = 1 - 0.45 * t;
    sp.setXYZ(i, c.x + (sp.getX(i) - c.x) * k, c.y + (sp.getY(i) - c.y) * k, c.z + (sp.getZ(i) - c.z) * k);
  }
  stemGeo.computeVertexNormals();
  cake.add(shadowy(new THREE.Mesh(stemGeo, new THREE.MeshStandardMaterial({ color: "#5B4A26", roughness: 0.55 }))));

  // a few crumbs on the plate by the cut
  const crumbMat = new THREE.MeshStandardMaterial({ color: "#DDB673", roughness: 0.9 });
  const crumbGeo = new THREE.IcosahedronGeometry(1, 1);
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 11; i++) {
    const a = (rnd() - 0.5) * 0.9, r = 1.05 + rnd() * 0.22, s = 0.012 + rnd() * 0.022;
    const m = shadowy(new THREE.Mesh(crumbGeo, crumbMat));
    m.scale.set(s * (0.8 + rnd() * 0.5), s * 0.7, s * (0.8 + rnd() * 0.5));
    m.position.set(r * Math.sin(a), s * 0.5, r * Math.cos(a));
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    cake.add(m);
  }

  const plate = new THREE.Mesh(plateGeometry(), new THREE.MeshPhysicalMaterial({
    color: "#F7F6F2", roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08,
  }));
  plate.receiveShadow = true;
  cake.add(plate);
  return cake;
}

export function initCake(container) {
  const stage = createStage(container, { fov: 22, transparent: true, shadows: true });
  const { renderer, scene, camera } = stage;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.environment = studioEnvironment(renderer, { wall: 0.5, panels: 4 });
  scene.environmentIntensity = 0.8;

  const key = new THREE.DirectionalLight(new THREE.Color(1, 0.96, 0.9), 2.4);
  key.position.set(-3, 6, 4);
  key.castShadow = true;
  const small = matchMedia("(max-width: 960px)").matches;     // phones: a lighter shadow map
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -2;
  key.shadow.camera.right = key.shadow.camera.top = 2;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);

  const cake = createCake();
  const pivot = new THREE.Group();
  pivot.add(cake);
  pivot.rotation.y = -0.75;                 // the cut slice turned three-quarters toward you
  scene.add(pivot);
  const shadow = contactShadow();
  shadow.scale.set(3.4, 3.4, 1);
  shadow.position.y = -0.075;
  scene.add(shadow);

  // Fit by measuring, not guessing: the outline of everything the spin and
  // the drag tilt can show (circles at the plate's radius, top and bottom, at
  // rest and tilted as far as dragging allows) is projected through the camera,
  // and distance and aim are adjusted until it just fits.
  const MAX_TILT = 0.4;
  const box = new THREE.Box3().setFromObject(cake);
  const yMin = box.min.y, yMax = box.max.y, rMax = 1.4;
  const outline = [];
  for (const tilt of [-MAX_TILT, 0, MAX_TILT]) {
    const rx = new THREE.Matrix4().makeRotationX(tilt);
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      for (const y of [yMin, yMax]) outline.push(new THREE.Vector3(rMax * Math.cos(a), y, rMax * Math.sin(a)).applyMatrix4(rx));
    }
  }
  const dir = new THREE.Vector3(0, 0.42, 1).normalize();      // a little from above: the top reads
  const target = new THREE.Vector3(0, (yMin + yMax) / 2, 0);
  const fit = (aspect, margin = 0.94) => {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    let dist = rMax * 6;
    const p = new THREE.Vector3();
    let b;
    for (let i = 0; i < 6; i++) {
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      b = { x0: 1, x1: -1, y0: 1, y1: -1 };
      for (const q of outline) {
        p.copy(q).project(camera);
        b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x);
        b.y0 = Math.min(b.y0, p.y); b.y1 = Math.max(b.y1, p.y);
      }
      const half = Math.max((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2);
      // re-aim at the middle of the drawing, then scale the distance to fit
      target.y += ((b.y0 + b.y1) / 2) * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      dist *= half / margin;
    }
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    return (b.x1 - b.x0) / (b.y1 - b.y0);                 // drawing's width : height at this aspect
  };
  // canvas takes the drawing's proportions, so its bottom is the plate
  container.style.aspectRatio = fit(1).toFixed(3);
  stage.onResize = (wpx, hpx) => fit(wpx / hpx);

  const spin = dragRotate(container, pivot, { idleSpeed: 0.3, maxPitch: MAX_TILT });
  stage.onFrame = (t, dt) => spin(dt);
  stage.resize();
  container.classList.add("is-ready");
  return stage;
}
