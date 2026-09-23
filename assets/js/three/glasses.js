// Round acetate glasses as a fine-line wireframe (same look as the hero
// models), for the free space under "That's where I come in." Thick rims with
// a slightly flattened top, keyhole bridge, end pieces and temples that bend
// down behind the ears. Drag to rotate; slow idle spin otherwise.

import * as THREE from "three";
import { createStage, cssColor, dragRotate } from "./stage.js";
import { Wire } from "./wire.js";

const DEPTH = 1.15;   // shifts everything forward so the spin axis sits mid-temple
const P = (x, y, z) => new THREE.Vector3(x, y, z + DEPTH);

export function createGlasses(style) {
  const w = new Wire();
  const wrap = (x) => -0.07 * (x / 1.1) ** 2;   // the front curves back a little toward the ends

  // Lens rims: rounded, flatter along the top (panto shape)
  for (const side of [-1, 1]) {
    const cx = side * 0.6, pts = [];
    for (let k = 0; k < 28; k++) {
      const t = (k / 28) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      const x = cx + 0.5 * Math.sign(c) * Math.abs(c) ** 0.85;
      const y = 0.45 * Math.sign(s) * Math.abs(s) ** (s > 0 ? 0.62 : 0.92) - 0.02;
      pts.push(P(x, y, wrap(x)));
    }
    w.tube(new THREE.CatmullRomCurve3(pts, true), () => 0.055, { closed: true, segments: 120, rings: 0, lines: 5 });
  }

  // Keyhole bridge between the rims
  w.tube(new THREE.CatmullRomCurve3([P(-0.13, 0.2, 0.01), P(-0.06, 0.28, 0.03), P(0.06, 0.28, 0.03), P(0.13, 0.2, 0.01)]),
    () => 0.045, { rings: 0, lines: 5 });

  // End pieces and temples: out from the rim, back along the head, down behind the ear
  for (const side of [-1, 1]) {
    const x = side;
    w.tube(new THREE.CatmullRomCurve3([P(1.08 * x, 0.24, wrap(1.08)), P(1.17 * x, 0.25, -0.05), P(1.2 * x, 0.25, -0.16)]),
      () => 0.05, { rings: 0, lines: 5 });
    w.tube(new THREE.CatmullRomCurve3([
      P(1.2 * x, 0.25, -0.16), P(1.23 * x, 0.25, -0.9), P(1.23 * x, 0.22, -1.65), P(1.21 * x, 0.1, -2.05), P(1.17 * x, -0.2, -2.32),
    ]), () => 0.034, { rings: 0, lines: 4 });
  }
  return w.build(style);
}

export function initGlasses(container) {
  const stage = createStage(container, { fov: 22, transparent: true });
  const { scene, camera } = stage;
  const glasses = createGlasses({ color: cssColor("--accent"), width: 1.1, ghost: 0.1 });
  const pivot = new THREE.Group();
  pivot.add(glasses);
  pivot.rotation.y = 0.6;                     // three-quarter view to start, like a product shot
  scene.add(pivot);

  const { yMin, yMax, rMax } = glasses.userData.bounds;
  const centerY = (yMin + yMax) / 2;
  const halfH = (yMax - yMin) / 2 * 1.15, halfW = rMax * 1.08;

  stage.onResize = (wpx, hpx) => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const dist = Math.max(halfH / t, halfW / (t * (wpx / hpx))) + rMax * 0.6;
    camera.position.set(0, centerY + dist * 0.28, dist);   // a little from above
    camera.lookAt(0, centerY, 0);
  };

  const spin = dragRotate(container, pivot, { idleSpeed: 0.3 });
  stage.onFrame = (t, dt) => {
    spin(dt);
    pivot.position.y = Math.sin(t * 0.9) * 0.03;
  };
  stage.resize();
  container.classList.add("is-ready");
  return stage;
}
