// "Cherry on top", literally: a cupcake as a fine-line wireframe in the hero
// style, for the free space under "That's where I come in." Pleated paper
// wrapper, a piped frosting swirl, and a cherry on its stem on top.
// Drag to rotate; slow idle spin otherwise.

import * as THREE from "three";
import { createStage, cssColor, dragRotate } from "./stage.js";
import { Wire } from "./wire.js";

const V2 = (r, y) => new THREE.Vector2(r, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function createCupcake(style) {
  const w = new Wire();

  // Paper wrapper: a flared cup, lots of vertical pleats
  w.lathe([V2(0, -1.0), V2(0.5, -1.0), V2(0.53, -0.8), V2(0.6, -0.4), V2(0.66, -0.16)],
    { ringsAt: [0.03, 0.97], meridians: 30 });
  // Cake crown just above the paper
  w.lathe([V2(0.66, -0.16), V2(0.71, -0.1), V2(0.7, -0.04), V2(0.6, 0.0), V2(0, 0.0)],
    { ringsAt: [0.35], meridians: 16 });

  // Frosting: piped in a rising spiral that tightens towards the top
  const turns = 2.6, pts = [];
  for (let k = 0; k <= 90; k++) {
    const t = k / 90, a = t * turns * Math.PI * 2;
    const r = 0.52 * (1 - t) + 0.06;
    pts.push(V3(r * Math.cos(a), 0.06 + t * 0.62, r * Math.sin(a)));
  }
  w.tube(new THREE.CatmullRomCurve3(pts), (t) => 0.2 * (1 - t) + 0.07, { rings: 34, lines: 8, segments: 180 });
  // the peak the piping bag leaves
  w.lathe([V2(0, 0.66), V2(0.12, 0.68), V2(0.08, 0.78), V2(0.03, 0.84), V2(0, 0.86)], { ringsAt: [0.3], meridians: 8 });

  // The cherry, sitting on the peak, and its stem
  const cherry = new THREE.Matrix4().makeTranslation(0.02, 1.02, 0);
  w.lathe([V2(0, -0.19), V2(0.12, -0.17), V2(0.2, -0.06), V2(0.2, 0.06), V2(0.13, 0.15), V2(0.04, 0.14), V2(0, 0.12)],
    { rings: 7, meridians: 12, matrix: cherry });
  w.tube(new THREE.CatmullRomCurve3([V3(0.02, 1.14, 0), V3(0.05, 1.32, 0.02), V3(0.16, 1.48, 0.03), V3(0.3, 1.56, 0.02)]),
    () => 0.018, { rings: 0, lines: 4 });
  return w.build(style);
}

export function initCupcake(container) {
  const stage = createStage(container, { fov: 22, transparent: true });
  const { scene, camera } = stage;
  const cupcake = createCupcake({ color: cssColor("--accent"), width: 1.1, ghost: 0.12 });
  const pivot = new THREE.Group();
  pivot.add(cupcake);
  scene.add(pivot);

  const { yMin, yMax, rMax } = cupcake.userData.bounds;
  const centerY = (yMin + yMax) / 2;
  const halfH = (yMax - yMin) / 2 * 1.12, halfW = rMax * 1.12;

  stage.onResize = (wpx, hpx) => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const dist = Math.max(halfH / t, halfW / (t * (wpx / hpx))) + rMax * 0.5;
    camera.position.set(0, centerY + dist * 0.2, dist);     // a little from above, to see into the swirl
    camera.lookAt(0, centerY, 0);
  };

  const spin = dragRotate(container, pivot, { idleSpeed: 0.35 });
  stage.onFrame = (t, dt) => {
    spin(dt);
    pivot.position.y = Math.sin(t * 0.9) * 0.03;
  };
  stage.resize();
  container.classList.add("is-ready");
  return stage;
}
