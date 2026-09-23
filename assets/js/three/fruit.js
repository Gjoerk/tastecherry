// Hero catch: a pair of cherries ("the cherry on top") as a fine-line
// wireframe in the accent colour. Drag to rotate; slow idle spin otherwise.

import * as THREE from "three";
import { createStage, cssColor, dragRotate } from "./stage.js";
import { createCherryWireframe } from "./cherry.js";

export function initFruit(container) {
  const stage = createStage(container, { fov: 24 });
  const { scene, camera } = stage;

  const fruit = createCherryWireframe({ color: cssColor("--accent"), width: 1.1, ghost: 0.12 });
  const pivot = new THREE.Group();   // drag rotates this
  pivot.add(fruit);
  scene.add(pivot);

  // Fit the whole model (at any spin angle) inside the canvas. The model's
  // proportions are published as --model-aspect so CSS can size the canvas to
  // the drawing: no dead space, so the leaf reaches the title and the footnote
  // sits right under the cherries.
  const { yMin, yMax, rMax } = fruit.userData.bounds;
  const bob = 0.035;
  const pad = 1.12;                              // breathing room + near-side perspective growth
  const centerY = (yMin + yMax) / 2;
  const halfH = ((yMax - yMin) / 2 + bob) * pad;
  const halfW = rMax * pad;
  container.style.setProperty("--model-aspect", (halfW / halfH).toFixed(3));

  stage.onResize = (w, h) => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const dist = Math.max(halfH / t, halfW / (t * (w / h))) + rMax * 0.35;
    camera.position.set(0, centerY + dist * 0.08, dist);
    camera.lookAt(0, centerY, 0);
  };

  const spin = dragRotate(container, pivot, { idleSpeed: 0.4 });
  stage.onFrame = (t, dt) => {
    spin(dt);
    pivot.position.y = Math.sin(t * 1.1) * 0.035;
  };

  stage.resize();
  container.classList.add("is-ready");
  return stage;
}
