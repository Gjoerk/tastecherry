// The hero's rotating cast next to the cherries: a squeeze bottle of ketchup
// ("Sauce") and a chili pepper ("Spice"). All fine-line
// wireframes (see wire.js), roughly 2 units tall around the origin; fruit.js
// rescales each to the cherries' frame.

import * as THREE from "three";
import { Wire } from "./wire.js";

const V2 = (r, y) => new THREE.Vector2(r, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Diner squeeze bottle, upside down mid-squeeze: round body, screw collar,
// cone cap with a long nozzle, and a drop of ketchup falling off the tip
export function createKetchup(style) {
  const w = new Wire();
  const hold = new THREE.Matrix4().compose(
    V3(0.08, 0.28, 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI - 0.38)),
    new THREE.Vector3(1, 1, 1)
  );
  w.lathe([
    V2(0, -1.0), V2(0.33, -1.0), V2(0.41, -0.95), V2(0.43, -0.8), V2(0.4, -0.52), V2(0.35, -0.34),   // pinched: mid-squeeze
    V2(0.4, -0.12), V2(0.43, 0.2), V2(0.41, 0.33), V2(0.39, 0.36),
  ], { rings: 10, meridians: 16, matrix: hold });
  // cap: screw collar, then a tall straight cone to a fine nozzle
  w.lathe([
    V2(0, 0.35), V2(0.445, 0.35), V2(0.452, 0.38), V2(0.452, 0.5), V2(0.42, 0.54), V2(0.3, 0.72), V2(0.19, 0.9),
    V2(0.09, 1.08), V2(0.045, 1.2), V2(0.03, 1.3), V2(0, 1.31),
  ], { ringsAt: [0.06, 0.16, 0.45], meridians: 18, matrix: hold });

  // the drop: just off the nozzle, falling (round at the bottom, drawn out at the top)
  const tip = V3(0, 1.31, 0).applyMatrix4(hold);
  const drop = new THREE.Matrix4().makeTranslation(tip.x - 0.03, tip.y - 0.28, tip.z);
  w.lathe([V2(0, -0.1), V2(0.07, -0.085), V2(0.095, -0.03), V2(0.07, 0.04), V2(0.028, 0.11), V2(0, 0.15)],
    { ringsAt: [0.3, 0.6], meridians: 8, matrix: drop });
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
