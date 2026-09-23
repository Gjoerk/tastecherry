// Round acetate glasses as a technical line drawing (same accent line as the
// hero models): solid parts, drawn only along their crisp edges. A flat
// acetate front with the lenses cut out, a keyhole bridge, hinge blocks and
// rectangular temples that bend down behind the ears. Drag to rotate.

import * as THREE from "three";
import { createStage, cssColor, dragRotate } from "./stage.js";
import { Wire } from "./wire.js";

const DEPTH = 1.15;   // shifts everything forward so the spin axis sits mid-temple
const THICK = 0.075;  // acetate thickness

// Rounded "panto" outline: a circle-ish shape, a little flatter along the top
const outline = (a, b, n = 72) => Array.from({ length: n }, (_, k) => {
  const t = (k / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
  return new THREE.Vector2(a * Math.sign(c) * Math.abs(c) ** 0.85, b * Math.sign(s) * Math.abs(s) ** (s > 0 ? 0.62 : 0.92));
});

const extrude = (shape, options = {}) => new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: false, curveSegments: 24, ...options });

export function createGlasses(style) {
  const w = new Wire();
  const place = (x, y, z, ry = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z + DEPTH), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));

  // Lens rims: an acetate ring each (outer outline with the lens cut out),
  // angled in a touch so the front wraps round the face
  for (const side of [-1, 1]) {
    const ring = new THREE.Shape(outline(0.56, 0.5));
    ring.holes.push(new THREE.Path(outline(0.45, 0.4).reverse()));
    w.edges(extrude(ring), { matrix: place(side * 0.62, 0, -THICK, -side * 0.09) });
  }

  // Keyhole bridge: a plate joining the rims with an arch cut under it
  const bridge = new THREE.Shape();
  bridge.moveTo(-0.1, 0.06);
  bridge.lineTo(-0.1, 0.34);
  bridge.lineTo(0.1, 0.34);
  bridge.lineTo(0.1, 0.06);
  bridge.quadraticCurveTo(0, 0.28, -0.1, 0.06);
  w.edges(extrude(bridge), { matrix: place(0, 0, -THICK) });

  // Hinge blocks on the outer corners, then the temples: a flat bar back along
  // the head that bends down behind the ear
  for (const side of [-1, 1]) {
    w.edges(new THREE.BoxGeometry(0.09, 0.13, 0.16), { matrix: place(side * 1.2, 0.24, -0.1) });
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.22, 0.24, -0.17 + DEPTH), new THREE.Vector3(side * 1.25, 0.24, -0.9 + DEPTH),
      new THREE.Vector3(side * 1.25, 0.21, -1.62 + DEPTH), new THREE.Vector3(side * 1.23, 0.08, -2.02 + DEPTH),
      new THREE.Vector3(side * 1.19, -0.2, -2.3 + DEPTH),
    ]);
    const bar = new THREE.Shape();
    bar.moveTo(-0.02, -0.05); bar.lineTo(0.02, -0.05); bar.lineTo(0.02, 0.05); bar.lineTo(-0.02, 0.05); bar.lineTo(-0.02, -0.05);   // tall and thin
    w.edges(new THREE.ExtrudeGeometry(bar, { steps: 48, bevelEnabled: false, extrudePath: path }), { angle: 40 });
  }
  return w.build(style);
}

export function initGlasses(container) {
  const stage = createStage(container, { fov: 22, transparent: true });
  const { scene, camera } = stage;
  const glasses = createGlasses({ color: cssColor("--accent"), width: 1.1, ghost: 0.08 });
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
