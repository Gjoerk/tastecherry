// Procedural strawberry, ~1.9 units tall, centred at origin.
// createStrawberry(): glazed solid (lathed body, seed dimples, instanced seeds, calyx).
// createStrawberryWireframe(): line-drawing version used in the hero.

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

const RED = new THREE.Color("#B8102A");
const RED_DEEP = new THREE.Color("#6E0716");
const PALE = new THREE.Color("#F1D9B8");
const SEED = new THREE.Color("#D2A441");
const LEAF = new THREE.Color("#3F7A2C");

// Silhouette (radius, height), from the tip up to the top centre.
const PROFILE = new THREE.SplineCurve([
  new THREE.Vector2(0.0, -1.0),
  new THREE.Vector2(0.09, -0.97),
  new THREE.Vector2(0.3, -0.76),
  new THREE.Vector2(0.55, -0.38),
  new THREE.Vector2(0.72, 0.02),
  new THREE.Vector2(0.8, 0.36),
  new THREE.Vector2(0.73, 0.62),
  new THREE.Vector2(0.48, 0.77),
  new THREE.Vector2(0.2, 0.76),
  new THREE.Vector2(0.0, 0.7),
]);

const SEED_ZONE = [0.05, 0.8]; // along the profile; above this sits the calyx

export function createStrawberry() {
  const group = new THREE.Group();

  const profilePts = PROFILE.getSpacedPoints(160);
  const surfaceAt = (v, phi) => {
    const p = PROFILE.getPointAt(v);
    return new THREE.Vector3(p.x * Math.cos(phi), p.y, -p.x * Math.sin(phi));
  };
  const normalAt = (v, phi) => {
    const t = PROFILE.getTangentAt(v); // (dr, dy)
    const nr = t.y, ny = -t.x;          // rotate tangent to point outward
    return new THREE.Vector3(nr * Math.cos(phi), ny, -nr * Math.sin(phi)).normalize();
  };

  // ---- Seeds: staggered rows, count per row follows the circumference
  const seeds = [];
  const rows = 17;
  for (let k = 0; k < rows; k++) {
    const v = SEED_ZONE[0] + (SEED_ZONE[1] - SEED_ZONE[0]) * (k / (rows - 1));
    const r = PROFILE.getPointAt(v).x;
    const count = Math.max(4, Math.round((Math.PI * 2 * r) / 0.14));
    for (let i = 0; i < count; i++) {
      const phi = ((i + (k % 2) * 0.5) / count) * Math.PI * 2 + (Math.sin(k * 12.9 + i * 7.3) * 0.12);
      seeds.push({ v, phi, p: surfaceAt(v, phi), n: normalAt(v, phi) });
    }
  }

  // ---- Body
  let body = new THREE.LatheGeometry(profilePts, 128);
  body.deleteAttribute("uv");
  body.deleteAttribute("normal");
  body = mergeVertices(body);
  body.computeVertexNormals();

  const pos = body.attributes.position;
  const nrm = body.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  const sigma2 = 0.045 * 0.045;

  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);

    let dimple = 0;
    for (const s of seeds) {
      const d2 = p.distanceToSquared(s.p);
      if (d2 < 0.02) dimple += Math.exp(-d2 / sigma2);
    }
    dimple = Math.min(dimple, 1);
    p.addScaledVector(n, -0.028 * dimple);
    pos.setXYZ(i, p.x, p.y, p.z);

    // Colour: pale shoulders under the calyx, deeper red in the dimples
    const topness = THREE.MathUtils.smoothstep(p.y, 0.5, 0.74) * THREE.MathUtils.smoothstep(0.62 - Math.hypot(p.x, p.z), -0.3, 0.2);
    c.copy(RED).lerp(RED_DEEP, dimple * 0.55).lerp(PALE, topness * 0.7);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  body.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  body.computeVertexNormals();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    sheen: 0.15,
    sheenColor: new THREE.Color("#ff8a8a"),
    sheenRoughness: 0.5,
  });
  const bodyMesh = new THREE.Mesh(body, bodyMat);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // ---- Seed instances, long axis along the meridian
  const seedGeo = new THREE.SphereGeometry(1, 10, 8);
  const seedMat = new THREE.MeshPhysicalMaterial({ color: SEED, roughness: 0.35, clearcoat: 0.6 });
  const seedMesh = new THREE.InstancedMesh(seedGeo, seedMat, seeds.length);
  const m = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const up = new THREE.Vector3();
  const side = new THREE.Vector3();
  const q = new THREE.Quaternion();
  seeds.forEach((s, i) => {
    const t = PROFILE.getTangentAt(s.v);
    up.set(t.x * Math.cos(s.phi), t.y, -t.x * Math.sin(s.phi)).normalize();
    side.crossVectors(up, s.n).normalize();
    basis.makeBasis(side, up, s.n);
    q.setFromRotationMatrix(basis);
    const at = s.p.clone().addScaledVector(s.n, -0.016);
    m.compose(at, q, new THREE.Vector3(0.015, 0.027, 0.013));
    seedMesh.setMatrixAt(i, m);
  });
  group.add(seedMesh);

  // ---- Calyx: sepals that hug the top surface, then curl off the shoulder
  const topCurve = profilePts.filter((pt) => pt.y > 0.5 && pt.x < 0.79).sort((a, b) => a.x - b.x);
  const surfaceY = (r) => {
    for (let i = 1; i < topCurve.length; i++) {
      if (topCurve[i].x >= r) {
        const a = topCurve[i - 1], b = topCurve[i];
        return THREE.MathUtils.lerp(a.y, b.y, (r - a.x) / (b.x - a.x || 1));
      }
    }
    return topCurve[topCurve.length - 1].y;
  };

  const leafMat = new THREE.MeshPhysicalMaterial({
    color: LEAF, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.DoubleSide,
  });

  const sepals = 9;
  for (let k = 0; k < sepals; k++) {
    const len = 0.86 + 0.12 * Math.sin(k * 3.1);
    const width = 0.2 + 0.03 * Math.cos(k * 2.3);
    const geo = new THREE.PlaneGeometry(1, 1, 6, 24);
    const lp = geo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const x = lp.getX(i);            // -0.5 … 0.5 across
      const t = lp.getY(i) + 0.5;      //  0 … 1 along
      const half = width * Math.pow(Math.sin(Math.PI * Math.min(t * 1.05, 1)), 0.75) * (1 - 0.35 * t);
      const across = x * 2 * half;
      const r = t * len;
      const rim = Math.max(0, r - 0.62);
      const y = surfaceY(Math.min(r, 0.78)) + 0.018 - rim * rim * 3.2 + t * t * 0.02
        + Math.abs(x) * 2 * half * 0.35; // slight cup
      lp.setXYZ(i, r, y, across);
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMat);
    leaf.rotation.y = (k / sepals) * Math.PI * 2 + Math.sin(k * 5.7) * 0.12;
    leaf.castShadow = true;
    group.add(leaf);
  }

  // ---- Stem
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.66, 0),
    new THREE.Vector3(0.015, 0.86, 0.01),
    new THREE.Vector3(0.07, 1.02, 0.02),
  ]);
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(stemCurve, 16, 0.042, 10, false),
    new THREE.MeshPhysicalMaterial({ color: LEAF.clone().multiplyScalar(0.8), roughness: 0.55 })
  );
  stem.castShadow = true;
  group.add(stem);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 8), stem.material);
  cap.position.copy(stemCurve.getPoint(1));
  group.add(cap);

  return group;
}

// ---------------------------------------------------------------- wireframe
// Technical-illustration version: contour lines (parallels + meridians),
// seed dots, sepal outlines and stem. Hidden lines are removed by an
// invisible depth-only body; `ghost` draws the back lines faintly.

export function createStrawberryWireframe({ color = "#CE0058", width = 1.1, ghost = 0.14 } = {}) {
  const group = new THREE.Group();
  const segs = [];                       // flat xyz pairs
  const line = (pts) => {
    for (let i = 0; i < pts.length - 1; i++) segs.push(...pts[i].toArray(), ...pts[i + 1].toArray());
  };
  const onBody = (v, phi, lift = 0) => {
    const p = PROFILE.getPointAt(v);
    const r = p.x + lift;
    return new THREE.Vector3(r * Math.cos(phi), p.y + (v > 0.9 ? lift : 0), -r * Math.sin(phi));
  };

  // Parallels (rings) and meridians
  const RINGS = 16, MERIDIANS = 24;
  const TOP = 0.86;                      // stop under the calyx so the crown stays clean
  for (let k = 1; k < RINGS; k++) {
    const v = 0.03 + (TOP - 0.03) * (k / RINGS);
    const ring = [];
    for (let i = 0; i <= 96; i++) ring.push(onBody(v, (i / 96) * Math.PI * 2, 0.002));
    line(ring);
  }
  for (let m = 0; m < MERIDIANS; m++) {
    const phi = (m / MERIDIANS) * Math.PI * 2;
    const mer = [];
    for (let i = 0; i <= 80; i++) mer.push(onBody(0.005 + (TOP - 0.005) * (i / 80), phi, 0.002));
    line(mer);
  }

  // Sepals: outline + midrib, following the same shape as the solid model
  const profilePts = PROFILE.getSpacedPoints(160);
  const topCurve = profilePts.filter((pt) => pt.y > 0.5 && pt.x < 0.79).sort((a, b) => a.x - b.x);
  const surfaceY = (r) => {
    for (let i = 1; i < topCurve.length; i++) {
      if (topCurve[i].x >= r) {
        const a = topCurve[i - 1], b = topCurve[i];
        return THREE.MathUtils.lerp(a.y, b.y, (r - a.x) / (b.x - a.x || 1));
      }
    }
    return topCurve[topCurve.length - 1].y;
  };
  const sepals = 9;
  for (let k = 0; k < sepals; k++) {
    const len = 0.86 + 0.12 * Math.sin(k * 3.1);
    const width_ = 0.2 + 0.03 * Math.cos(k * 2.3);
    const rot = (k / sepals) * Math.PI * 2 + Math.sin(k * 5.7) * 0.12;
    const at = (t, x) => {
      const half = width_ * Math.pow(Math.sin(Math.PI * Math.min(t * 1.05, 1)), 0.75) * (1 - 0.35 * t);
      const r = t * len;
      const rim = Math.max(0, r - 0.62);
      const y = surfaceY(Math.min(r, 0.78)) + 0.03 - rim * rim * 3.2 + t * t * 0.02 + Math.abs(x) * half * 0.35;
      return new THREE.Vector3(r, y, x * half).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    };
    // one closed outline per sepal: up one edge, back down the other
    const outline = [];
    for (let i = 0; i <= 24; i++) outline.push(at(i / 24, -1));
    for (let i = 24; i >= 0; i--) outline.push(at(i / 24, 1));
    line(outline);
  }

  // Stem: four lines along a tube
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(0.015, 0.86, 0.01), new THREE.Vector3(0.07, 1.02, 0.02),
  ]);
  for (let s = 0; s < 4; s++) {
    const a = (s / 4) * Math.PI * 2;
    const off = new THREE.Vector3(Math.cos(a) * 0.035, 0, Math.sin(a) * 0.035);
    line(stemCurve.getPoints(12).map((p) => p.clone().add(off)));
  }

  const geo = new LineSegmentsGeometry().setPositions(segs);
  const front = new LineSegments2(geo, new LineMaterial({ color, linewidth: width, transparent: true, opacity: 0.95 }));
  front.renderOrder = 2;
  const back = new LineSegments2(geo, new LineMaterial({ color, linewidth: width * 0.8, transparent: true, opacity: ghost, depthTest: false }));
  back.renderOrder = 0;

  // Depth-only body hides back lines; pushed back slightly so surface lines pass
  const occluder = new THREE.Mesh(
    new THREE.LatheGeometry(profilePts, 96),
    new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })
  );
  occluder.renderOrder = 1;

  // Seeds as dots
  const seedPts = [];
  const rows = 15;
  for (let k = 0; k < rows; k++) {
    const v = 0.08 + 0.7 * (k / (rows - 1));
    const r = PROFILE.getPointAt(v).x;
    const count = Math.max(4, Math.round((Math.PI * 2 * r) / 0.17));
    for (let i = 0; i < count; i++) {
      const phi = ((i + 0.5 + (k % 2) * 0.5) / count) * Math.PI * 2;   // between meridians
      seedPts.push(...onBody(v + 0.012, phi, 0.006).toArray());
    }
  }
  const dot = document.createElement("canvas");
  dot.width = dot.height = 64;
  const dc = dot.getContext("2d");
  dc.fillStyle = "#fff";
  dc.beginPath(); dc.arc(32, 32, 28, 0, Math.PI * 2); dc.fill();
  const seeds = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(seedPts, 3)),
    new THREE.PointsMaterial({ color, size: 0.12, map: new THREE.CanvasTexture(dot), alphaTest: 0.5, transparent: true })
  );
  seeds.renderOrder = 2;

  group.add(back, occluder, front, seeds);
  return group;
}
