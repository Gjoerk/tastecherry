// The hero's rotating cast next to the cherries: a glass ketchup bottle
// ("Sauce") and a chili pepper ("Spice"). All fine-line
// wireframes (see wire.js), roughly 2 units tall around the origin; fruit.js
// rescales each to the cherries' frame.

import * as THREE from "three";
import { Wire } from "./wire.js";

const V2 = (r, y) => new THREE.Vector2(r, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Classic glass ketchup bottle, upright: long neck, shoulders, label band, ridged cap
export function createKetchup(style) {
  const w = new Wire();
  const tilt = new THREE.Matrix4().makeRotationZ(-0.1);
  const body = [
    V2(0, -1.05), V2(0.3, -1.05), V2(0.4, -1.0), V2(0.43, -0.85), V2(0.44, -0.4), V2(0.43, -0.05),
    V2(0.38, 0.18), V2(0.27, 0.38), V2(0.19, 0.58), V2(0.16, 0.78), V2(0.155, 0.9), V2(0.178, 0.93), V2(0.172, 0.96),
  ];
  w.lathe(body, { rings: 11, meridians: 16, matrix: tilt });
  // label band: doubled lines like a printed edge
  w.lathe(body, { ringsAt: [0.2, 0.207, 0.5, 0.507], meridians: 0, solid: false, matrix: tilt });
  const cap = [V2(0, 0.95), V2(0.188, 0.95), V2(0.194, 0.97), V2(0.194, 1.17), V2(0.176, 1.2), V2(0, 1.2)];
  w.lathe(cap, { ringsAt: [0.12, 0.62], meridians: 28, matrix: tilt });
  return w.build(style);
}

// A chili pepper: curved tapering pod, a low calyx and a crooked stem
export function createChili(style) {
  const w = new Wire();
  const pod = new THREE.CatmullRomCurve3([
    V3(0.05, 0.72, 0), V3(0.13, 0.32, 0.05), V3(0.06, -0.16, 0.02), V3(-0.14, -0.6, -0.03), V3(-0.44, -0.9, 0), V3(-0.64, -0.97, 0.02),
  ]);
  const smooth = (x) => x * x * (3 - 2 * x);
  w.tube(pod, (t) => 0.25 * Math.pow(1 - t, 0.8) * (0.72 + 0.28 * smooth(Math.min(t / 0.14, 1))), { rings: 18, lines: 10 });

  // calyx: a shallow crown over the top of the pod, facing out along it
  const top = pod.getPointAt(0), out = pod.getTangentAt(0).negate();
  const crown = new THREE.Matrix4().compose(top, new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), out), new THREE.Vector3(1, 1, 1));
  w.lathe([V2(0, -0.05), V2(0.17, -0.05), V2(0.19, -0.01), V2(0.12, 0.04), V2(0.05, 0.07), V2(0, 0.075)], { ringsAt: [0.35], meridians: 10, matrix: crown });

  const stem = new THREE.CatmullRomCurve3([
    top.clone().addScaledVector(out, 0.08), top.clone().addScaledVector(out, 0.22).add(V3(0.03, 0, 0)), V3(0.2, 1.1, 0.02), V3(0.3, 1.16, 0.03),
  ]);
  w.tube(stem, () => 0.035, { rings: 2, lines: 5 });
  return w.build(style);
}
