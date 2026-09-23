// A pair of cherries on joined stems with a leaf, drawn as fine-line
// wireframe: contour lines on each fruit, tube lines for stems, leaf outline
// and midrib. Hidden lines are removed by invisible depth-only bodies;
// `ghost` draws the back lines faintly. ~2.2 units tall, centred near origin.

import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

// Cherry silhouette (radius, height) from the bottom centre up to the stem cavity
const PROFILE = new THREE.SplineCurve([
  new THREE.Vector2(0.0, -0.45),
  new THREE.Vector2(0.14, -0.44),
  new THREE.Vector2(0.36, -0.36),
  new THREE.Vector2(0.5, -0.14),
  new THREE.Vector2(0.52, 0.08),
  new THREE.Vector2(0.44, 0.29),
  new THREE.Vector2(0.24, 0.4),
  new THREE.Vector2(0.08, 0.36),
  new THREE.Vector2(0.0, 0.31),
]);
const TOP = PROFILE.getPointAt(1);

export function createCherryWireframe({ color = "#CE0058", width = 1.1, ghost = 0.12 } = {}) {
  const group = new THREE.Group();
  const segs = [];
  const bounds = { yMin: Infinity, yMax: -Infinity, rMax: 0 }; // r = distance from the spin axis
  const line = (pts) => {
    for (const p of pts) {
      bounds.yMin = Math.min(bounds.yMin, p.y);
      bounds.yMax = Math.max(bounds.yMax, p.y);
      bounds.rMax = Math.max(bounds.rMax, Math.hypot(p.x, p.z));
    }
    for (let i = 0; i < pts.length - 1; i++) segs.push(...pts[i].toArray(), ...pts[i + 1].toArray());
  };
  const occluders = [];

  const up = new THREE.Vector3(0, 1, 0);
  const onFruit = (v, phi) => {
    const p = PROFILE.getPointAt(v);
    const r = p.x + 0.002;
    return new THREE.Vector3(r * Math.cos(phi), p.y, -r * Math.sin(phi));
  };

  // ---- Two fruits, slightly different size, height and lean
  const fruits = [
    { at: new THREE.Vector3(-0.33, -0.6, 0.1), scale: 0.74, lean: 0.12, turn: 0.4 },
    { at: new THREE.Vector3(0.35, -0.72, -0.08), scale: 0.7, lean: -0.1, turn: 1.9 },
  ];
  const tops = [];
  for (const f of fruits) {
    const m = new THREE.Matrix4().compose(
      f.at,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, f.turn, f.lean)),
      new THREE.Vector3().setScalar(f.scale)
    );
    const tf = (p) => p.applyMatrix4(m);

    const RINGS = 11, MERIDIANS = 18;
    for (let k = 1; k < RINGS; k++) {
      const v = 0.04 + 0.86 * (k / RINGS);
      const ring = [];
      for (let i = 0; i <= 72; i++) ring.push(tf(onFruit(v, (i / 72) * Math.PI * 2)));
      line(ring);
    }
    for (let j = 0; j < MERIDIANS; j++) {
      const phi = (j / MERIDIANS) * Math.PI * 2;
      const mer = [];
      for (let i = 0; i <= 48; i++) mer.push(tf(onFruit(0.01 + 0.97 * (i / 48), phi)));
      line(mer);
    }

    const occ = new THREE.Mesh(
      new THREE.LatheGeometry(PROFILE.getSpacedPoints(64), 64),
      new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })
    );
    occ.applyMatrix4(m);
    occ.renderOrder = 1;
    occluders.push(occ);
    tops.push(tf(new THREE.Vector3(0, TOP.y + 0.02, 0)));
  }

  // ---- Stems: arc up from each fruit to a shared joint, drawn as thin tubes
  const joint = new THREE.Vector3(-0.06, 0.34, 0.02);   // short stems: leaf sits close above the fruit
  const stems = [
    new THREE.CatmullRomCurve3([tops[0], new THREE.Vector3(-0.3, -0.12, 0.07), new THREE.Vector3(-0.18, 0.18, 0.04), joint]),
    new THREE.CatmullRomCurve3([tops[1], new THREE.Vector3(0.33, -0.24, -0.05), new THREE.Vector3(0.14, 0.16, -0.02), joint]),
  ];
  const tubeLines = (curve, radius, count = 3) => {
    const frames = curve.computeFrenetFrames(40, false);
    for (let s = 0; s < count; s++) {
      const a = (s / count) * Math.PI * 2;
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const p = curve.getPointAt(i / 40);
        const off = frames.normals[i].clone().multiplyScalar(Math.cos(a) * radius)
          .add(frames.binormals[i].clone().multiplyScalar(Math.sin(a) * radius));
        pts.push(p.add(off));
      }
      line(pts);
    }
  };
  stems.forEach((c) => tubeLines(c, 0.02));

  // ---- Leaf at the joint: outline + midrib + a few veins
  const leafLen = 0.82, leafW = 0.24;
  const leafBase = joint.clone();
  const leafDir = new THREE.Vector3(-0.85, 0.28, -0.3).normalize();
  const flatSide = new THREE.Vector3().crossVectors(leafDir, up).normalize();
  const flatUp = new THREE.Vector3().crossVectors(flatSide, leafDir).normalize();
  const tilt = 1.05;                                // roll the blade so its face turns to the viewer
  const leafSide = flatSide.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(flatUp, Math.sin(tilt)).normalize();
  const leafUp = new THREE.Vector3().crossVectors(leafSide, leafDir).normalize();
  const leafAt = (t, x) => {
    const half = leafW * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.15 * t);
    const droop = -0.28 * t * t;                    // tip curls down
    const cup = 0.08 * x * x;                       // slight fold along the midrib
    return leafBase.clone()
      .addScaledVector(leafDir, t * leafLen)
      .addScaledVector(leafSide, x * half)
      .addScaledVector(leafUp, droop + cup);
  };
  const outline = [];
  for (let i = 0; i <= 32; i++) outline.push(leafAt(i / 32, -1));
  for (let i = 32; i >= 0; i--) outline.push(leafAt(i / 32, 1));
  line(outline);
  const rib = [];
  for (let i = 0; i <= 32; i++) rib.push(leafAt(i / 32, 0));
  line(rib);
  for (let k = 1; k <= 5; k++) {
    const t0 = k / 6.5;
    for (const side of [-1, 1]) {
      const vein = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        vein.push(leafAt(Math.min(t0 + u * 0.12, 1), side * u * 0.85));
      }
      line(vein);
    }
  }

  const geo = new LineSegmentsGeometry().setPositions(segs);
  const front = new LineSegments2(geo, new LineMaterial({ color, linewidth: width, transparent: true, opacity: 0.95 }));
  front.renderOrder = 2;
  const back = new LineSegments2(geo, new LineMaterial({ color, linewidth: width * 0.8, transparent: true, opacity: ghost, depthTest: false }));
  back.renderOrder = 0;

  group.add(back, ...occluders, front);
  group.userData.bounds = bounds;
  return group;
}
