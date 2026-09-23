// "Cherry on top", literally: a round layer cake as a fine-line wireframe in
// the hero style, for the free space under "That's where I come in." Two
// layers with a filling line, piped rosettes round the top edge, a cherry on
// its stem in the middle, on a thin plate. Drag to rotate; slow idle spin.

import * as THREE from "three";
import { createStage, cssColor, dragRotate, trackLines } from "./stage.js";
import { Wire } from "./wire.js";

const V2 = (r, y) => new THREE.Vector2(r, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function createCake(style) {
  const w = new Wire();

  // Plate: just its rim (lines across a flat disc would read as sun rays)
  w.lathe([V2(1.12, -0.8), V2(1.3, -0.8), V2(1.34, -0.76), V2(1.3, -0.73), V2(1.12, -0.73)], { ringsAt: [0.2, 0.5, 0.8], meridians: 0 });
  w.occlude(new THREE.CylinderGeometry(1.34, 1.3, 0.07, 64).translate(0, -0.765, 0));
  // Cake: straight sides, softened top edge; rings mark the layers and the filling.
  // Lines run up the sides only; the top gets rings, not spokes.
  w.lathe([V2(0.96, -0.73), V2(1.0, -0.68), V2(1.0, -0.2), V2(1.0, 0.26), V2(0.97, 0.33), V2(0.88, 0.36)],
    { ringsAt: [0.08, 0.3, 0.52, 0.54, 0.76], meridians: 24, solid: false });
  w.lathe([V2(0, -0.73), V2(0.96, -0.73), V2(1.0, -0.68), V2(1.0, 0.26), V2(0.97, 0.33), V2(0.88, 0.36), V2(0, 0.36)],
    { ringsAt: [0.9], meridians: 0 });

  // Piped rosettes round the top edge: little swirled peaks
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const m = new THREE.Matrix4().makeTranslation(0.78 * Math.cos(a), 0.36, 0.78 * Math.sin(a));
    w.lathe([V2(0, 0), V2(0.13, 0.01), V2(0.14, 0.06), V2(0.1, 0.12), V2(0.05, 0.17), V2(0, 0.2)], { ringsAt: [0.35, 0.65], meridians: 6, matrix: m });
  }

  // The cherry in the middle, and its stem
  const cherry = new THREE.Matrix4().makeTranslation(0, 0.58, 0);
  w.lathe([V2(0, -0.21), V2(0.13, -0.19), V2(0.22, -0.07), V2(0.22, 0.07), V2(0.14, 0.17), V2(0.04, 0.15), V2(0, 0.13)],
    { rings: 7, meridians: 12, matrix: cherry });
  w.tube(new THREE.CatmullRomCurve3([V3(0, 0.72, 0), V3(0.03, 0.92, 0.02), V3(0.13, 1.08, 0.03), V3(0.27, 1.16, 0.02)]),
    () => 0.018, { rings: 0, lines: 4 });
  return w.build(style);
}

export function initCake(container) {
  const stage = createStage(container, { fov: 22, transparent: true });
  const { scene, camera } = stage;
  const cake = createCake({ color: cssColor("--line"), width: 1.1, ghost: 0.1 });
  const pivot = new THREE.Group();
  pivot.add(cake);
  scene.add(pivot);
  trackLines(pivot);

  // Fit by measuring, not guessing: the outline of everything the spin can
  // show (circles at full radius, top and bottom) is projected through the
  // camera, and distance and aim are adjusted until it just fits.
  const { yMin, yMax, rMax } = cake.userData.bounds;
  const outline = [];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    for (const y of [yMin, yMax]) outline.push(new THREE.Vector3(rMax * Math.cos(a), y, rMax * Math.sin(a)));
  }
  const dir = new THREE.Vector3(0, 0.3, 1).normalize();       // a little from above
  const target = new THREE.Vector3(0, (yMin + yMax) / 2, 0);
  const fit = (aspect, margin = 0.94) => {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    let dist = rMax * 6;
    const p = new THREE.Vector3();
    let box;
    for (let i = 0; i < 6; i++) {
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      box = { x0: 1, x1: -1, y0: 1, y1: -1 };
      for (const q of outline) {
        p.copy(q).project(camera);
        box.x0 = Math.min(box.x0, p.x); box.x1 = Math.max(box.x1, p.x);
        box.y0 = Math.min(box.y0, p.y); box.y1 = Math.max(box.y1, p.y);
      }
      const half = Math.max((box.x1 - box.x0) / 2, (box.y1 - box.y0) / 2);
      // re-aim at the middle of the drawing, then scale the distance to fit
      target.y += ((box.y0 + box.y1) / 2) * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      dist *= half / margin;
    }
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    return (box.x1 - box.x0) / (box.y1 - box.y0);          // drawing's width : height at this aspect
  };
  // canvas takes the drawing's proportions, so its bottom is the plate
  container.style.aspectRatio = fit(1).toFixed(3);
  stage.onResize = (wpx, hpx) => fit(wpx / hpx);

  const spin = dragRotate(container, pivot, { idleSpeed: 0.3 });
  stage.onFrame = (t, dt) => spin(dt);
  stage.resize();
  container.classList.add("is-ready");
  return stage;
}
