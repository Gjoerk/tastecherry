// Rough milky diamond → cut round brilliant, rendered live (each on its own
// transparent canvas, drag to turn). Tuned to match the Cycles renders:
//
//   rough  dense rounded-octahedron mesh (lumps, etching, trigon pits) with the
//          same ray-traced gem shader: rays enter through the bumpy surface
//          (frosted), bounce inside the stone's 96 bounding planes and come
//          out partly scattered to white (milky)
//   cut    57-facet round brilliant with the ray-traced gem shader (gem.js):
//          8 internal bounces, total internal reflection, diamond dispersion,
//          against a high-contrast studio of soft boxes and black flags
//
// Both sit on a soft contact shadow cast to the right, like the renders.

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { createStage, dragRotate } from "./stage.js";
import { createGemMaterial, cubeEnvironment, gemStudio, supportPlanes } from "./gem.js";

// ---------------------------------------------------------------- noise
const hash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const l = THREE.MathUtils.lerp;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf
  ) * 2 - 1;
}
const fbm = (v, octaves = 4) => {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(v.x * f, v.y * f, v.z * f);
    amp *= 0.5; f *= 2.03;
  }
  return sum;
};

// ------------------------------------------------------- rough crystal
// A rounded, slightly lopsided octahedron: big lumps, fine etching, and the
// shallow triangular pits ("trigons") real rough diamonds have on their faces.
function roughGeometry(detail = 72) {
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  geo = mergeVertices(geo);

  // trigon pits: centres scattered over the eight octahedron faces
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pits = Array.from({ length: 70 }, () => {
    const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    return { d, r: 0.05 + rnd() * 0.09, depth: 0.004 + rnd() * 0.01 };
  });

  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const octa = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    octa.copy(v).divideScalar(Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z));
    const r = v.clone().lerp(octa.multiplyScalar(1.5), 0.72);
    const lump = 1 + fbm(v.clone().multiplyScalar(1.4), 3) * 0.1;
    const etch = 1 + fbm(v.clone().multiplyScalar(9), 3) * 0.009 + fbm(v.clone().multiplyScalar(26), 2) * 0.003;
    let pit = 0;
    for (const p of pits) {
      const d = v.distanceTo(p.d);
      if (d < p.r) pit -= p.depth * smooth(1 - d / p.r);
    }
    r.multiplyScalar(lump * etch + pit);
    r.y *= 1.08;
    r.x *= 0.96;
    pos.setXYZ(i, r.x, r.y, r.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------ round brilliant
// 57 facets: table, 8 star, 8 bezel, 16 upper girdle | girdle | 16 lower girdle, 8 pavilion mains.
function brilliantGeometry() {
  const R = 1;
  const girdle = 0.022;
  const tableR = 0.56;
  const starR = 0.77;
  const lowerR = 0.2;
  const tanCrown = Math.tan(THREE.MathUtils.degToRad(34.5));
  const tanPav = Math.tan(THREE.MathUtils.degToRad(40.75));

  const crownY = (r) => girdle + (R - r) * tanCrown;
  const pavY = (r) => -girdle - (R - r) * tanPav;
  const at = (j, r, y) => {
    const a = (j / 16) * Math.PI * 2;
    return new THREE.Vector3(r * Math.cos(a), y, -r * Math.sin(a));
  };
  const i8 = (k) => ((k % 8) + 8) % 8;

  const tableC = new THREE.Vector3(0, crownY(tableR), 0);
  const culet = new THREE.Vector3(0, pavY(0), 0);
  const T = (k) => at(2 * i8(k), tableR, crownY(tableR));
  const M = (k) => at(2 * i8(k) + 1, starR, crownY(starR) + 0.012);
  const G = (j) => at(j % 16, R, girdle);
  const B = (j) => at(j % 16, R, -girdle);
  const Q = (k) => at(2 * i8(k) + 1, lowerR, pavY(lowerR));

  const tris = [];
  for (let k = 0; k < 8; k++) {
    tris.push([tableC, T(k), T(k + 1)]);                 // table
    tris.push([T(k), M(k), T(k + 1)]);                   // star
    tris.push([T(k), M(k - 1), G(2 * k)]);               // bezel (kite)
    tris.push([T(k), G(2 * k), M(k)]);
    tris.push([M(k), G(2 * k), G(2 * k + 1)]);           // upper girdle
    tris.push([M(k), G(2 * k + 1), G(2 * k + 2)]);
    tris.push([Q(k), B(2 * k), B(2 * k + 1)]);           // lower girdle
    tris.push([Q(k), B(2 * k + 1), B(2 * k + 2)]);
    tris.push([culet, Q(k - 1), B(2 * k)]);              // pavilion main (kite)
    tris.push([culet, B(2 * k), Q(k)]);
  }
  for (let j = 0; j < 16; j++) {                         // girdle band
    tris.push([G(j), G(j + 1), B(j + 1)]);
    tris.push([G(j), B(j + 1), B(j)]);
  }

  // Wind every triangle outward (the stone is convex around the origin)
  const positions = [];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3();
  for (const [a, b, d] of tris) {
    e1.subVectors(b, a); e2.subVectors(d, a); n.crossVectors(e1, e2);
    c.copy(a).add(b).add(d).divideScalar(3);
    const out = n.dot(c) > 0;
    for (const p of out ? [a, b, d] : [a, d, b]) positions.push(p.x, p.y, p.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals(); // non-indexed → one flat normal per facet
  geo.translate(0, 0.28, 0);  // centre vertically
  return geo;
}

// ------------------------------------------------------- soft floor shadow
// Offset to the right and stretched, as the renders' key light casts it
function contactShadow(opacity = 0.22) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(15,15,14,${opacity})`);
  g.addColorStop(0.45, `rgba(15,15,14,${opacity * 0.55})`);
  g.addColorStop(1, "rgba(15,15,14,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, toneMapped: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function frame(stage, radius) {
  stage.onResize = (w, h) => {
    const vFov = THREE.MathUtils.degToRad(stage.camera.fov);
    const fit = Math.max(radius / Math.tan(vFov / 2), radius / (Math.tan(vFov / 2) * (w / h)));
    stage.camera.position.set(0, fit * 0.2, fit);
    stage.camera.lookAt(0, -0.12, 0);
  };
}

const filmic = (stage, exposure) => {
  stage.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.renderer.toneMappingExposure = exposure;
};

// ---------------------------------------------------------------- scenes
export function initDiamonds({ rough, cut }) {
  // Rough: ray-traced like the cut stone, but frosted and milky
  const a = createStage(rough, { fov: 24, transparent: true });
  filmic(a, 1.0);
  const roughGeo = roughGeometry();
  const roughEnv = cubeEnvironment(a.renderer, gemStudio({ wall: 0.58, light: 5, flags: 22, boxes: 14, seed: 11 }), 512);
  const roughStone = new THREE.Mesh(roughGeo, createGemMaterial(roughGeo, roughEnv, {
    ior: 2.0, dispersion: 0.012, bounces: 6, planes: supportPlanes(roughGeo), milk: 0.16, frost: 0.9,
  }));
  roughStone.onBeforeRender = (renderer, scene, camera) => roughStone.material.userData.update(roughStone, camera);
  const roughBody = new THREE.Group();
  roughBody.add(roughStone);
  roughBody.scale.setScalar(0.88);
  roughBody.rotation.set(0.35, 0.4, 0.2);
  const roughPivot = new THREE.Group();
  roughPivot.add(roughBody);
  a.scene.add(roughPivot);
  const shadowA = contactShadow(0.24);
  shadowA.scale.set(2.8, 1.5, 1);
  shadowA.position.set(0.45, -1.12, -0.1);
  a.scene.add(shadowA);
  frame(a, 1.6);

  // Cut: ray-traced facets against a high-contrast studio
  const b = createStage(cut, { fov: 24, transparent: true });
  filmic(b, 1.05);
  const gemGeo = brilliantGeometry();
  const envCube = cubeEnvironment(b.renderer, gemStudio({ wall: 0.8, light: 5, flags: 22, boxes: 20 }), 512);
  const cutStone = new THREE.Mesh(gemGeo, createGemMaterial(gemGeo, envCube, { dispersion: 0.02, bounces: 8, frost: 0.4 }));
  cutStone.onBeforeRender = (renderer, scene, camera) => cutStone.material.userData.update(cutStone, camera);
  const cutPivot = new THREE.Group();
  cutPivot.rotation.x = 0.22;       // three-quarter view: table, crown and pointed pavilion all read
  cutPivot.scale.setScalar(1.32);
  cutPivot.add(cutStone);
  b.scene.add(cutPivot);
  const shadowB = contactShadow(0.26);
  shadowB.scale.set(2.8, 1.4, 1);
  shadowB.position.set(0.5, -0.98, -0.1);
  b.scene.add(shadowB);
  frame(b, 1.6);

  // Drag to rotate (idle spin when untouched)
  const spinRough = dragRotate(rough, roughPivot, { idleSpeed: 0.25 });
  const spinCut = dragRotate(cut, cutPivot, { idleSpeed: 0.35 });
  a.onFrame = (t, dt) => spinRough(dt);
  b.onFrame = (t, dt) => spinCut(dt);

  a.resize();
  b.resize();
  rough.classList.add("is-ready");
  cut.classList.add("is-ready");
  return [a, b];
}
