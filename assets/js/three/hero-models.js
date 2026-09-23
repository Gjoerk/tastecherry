// The hero's rotating cast next to the cherries: a diner squeeze bottle of
// ketchup ("Sauce") and a chili pepper ("Spice"). All fine-line
// wireframes (see wire.js), roughly 2 units tall around the origin; fruit.js
// rescales each to the cherries' frame.

import * as THREE from "three";
import { Wire } from "./wire.js";

const V2 = (r, y) => new THREE.Vector2(r, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Diner squeeze bottle, leaning: tall straight body, ridged screw collar, a
// step ring, a slim cone nozzle with its stopper, and the stopper's tether strap
export function createKetchup(style) {
  const w = new Wire();
  const lean = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.18, 0, -0.36));
  // body: straight sides, softly rounded foot and shoulder
  w.lathe([
    V2(0, -1.25), V2(0.25, -1.25), V2(0.292, -1.22), V2(0.3, -1.14), V2(0.3, -0.4), V2(0.3, 0.42),
    V2(0.292, 0.5), V2(0.27, 0.545),
  ], { rings: 12, meridians: 16, matrix: lean });
  // screw collar: fine vertical ridges; hidden-line solid is an exact cylinder
  // (a spline through its square corners would bulge out and swallow the ridges)
  w.lathe([V2(0.285, 0.54), V2(0.292, 0.56), V2(0.292, 0.66), V2(0.292, 0.76), V2(0.28, 0.785)],
    { ringsAt: [0.02, 0.97], meridians: 28, solid: false, matrix: lean });
  w.occlude(new THREE.CylinderGeometry(0.286, 0.286, 0.245, 48),
    lean.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.6625, 0)));
  // top of the collar, step ring, cone up to the stopper
  w.lathe([
    V2(0.28, 0.785), V2(0.2, 0.8), V2(0.168, 0.81), V2(0.168, 0.87), V2(0.14, 0.9), V2(0.1, 0.93),
    V2(0.075, 1.04), V2(0.052, 1.17), V2(0.038, 1.26), V2(0.05, 1.275), V2(0.05, 1.33), V2(0.032, 1.355), V2(0, 1.36),
  ], { ringsAt: [0.1, 0.2, 0.3, 0.52, 0.66, 0.8, 0.9], meridians: 12, matrix: lean });
  // tether: a thin strap from the stopper, looping out and down to the collar
  const strap = new THREE.CatmullRomCurve3([
    V3(0.05, 1.3, 0), V3(0.2, 1.3, 0.02), V3(0.36, 1.12, 0.03), V3(0.36, 0.86, 0.02), V3(0.29, 0.72, 0),
  ].map((p) => p.applyMatrix4(lean)));
  w.tube(strap, () => 0.012, { rings: 0, lines: 3 });
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
