// Hero catch: fine-line wireframes in the accent colour that swap with the
// title's word: cherries (Taste), ketchup bottle (Sauce), chili
// (Spice). Drag to rotate; slow idle spin otherwise.

import * as THREE from "three";
import { createStage, cssColor, dragRotate } from "./stage.js";
import { createCherryWireframe } from "./cherry.js";
import { createKetchup, createChili } from "./hero-models.js";
import { setFade } from "./wire.js";

const FADE = 0.8;    // seconds out, then the same in
const ease = (x) => x * x * (3 - 2 * x);   // smoothstep: soft start and finish

export function initFruit(container) {
  const stage = createStage(container, { fov: 24 });
  const { scene, camera } = stage;
  const style = { color: cssColor("--accent"), width: 1.1, ghost: 0.12 };

  const cherries = createCherryWireframe(style);
  const models = [cherries, createKetchup(style), createChili(style)];

  // Frame everything on the cherries: every other model is scaled and moved
  // into the same box, so the canvas (sized from --model-aspect) never changes.
  const { yMin, yMax, rMax } = cherries.userData.bounds;
  const centerY = (yMin + yMax) / 2;
  const pivot = new THREE.Group();   // drag rotates this
  const slots = models.map((m, i) => {
    const slot = new THREE.Group();
    slot.add(m);
    if (i > 0) {
      const b = m.userData.bounds;
      const s = Math.min((yMax - yMin) / (b.yMax - b.yMin), rMax / b.rMax);
      slot.scale.setScalar(s);
      slot.position.y = centerY - ((b.yMin + b.yMax) / 2) * s;
    }
    setFade(slot, i === 0 ? 1 : 0);
    pivot.add(slot);
    return slot;
  });
  scene.add(pivot);

  // Publish the drawing's proportions so CSS can size the canvas to it: no
  // dead space, the top reaches the title and the footnote sits right under.
  const bob = 0.035;
  const pad = 1.12;                              // breathing room + near-side perspective growth
  const halfH = ((yMax - yMin) / 2 + bob) * pad;
  const halfW = rMax * pad;
  container.style.setProperty("--model-aspect", (halfW / halfH).toFixed(3));

  stage.onResize = (w, h) => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const dist = Math.max(halfH / t, halfW / (t * (w / h))) + rMax * 0.35;
    camera.position.set(0, centerY + dist * 0.08, dist);
    camera.lookAt(0, centerY, 0);
  };

  // Swap: the shown model fades out, then the next fades in
  let shown = 0, next = 0, k = 1;               // k: fade level of `shown`
  const show = (i) => { next = i % slots.length; };

  const spin = dragRotate(container, pivot, { idleSpeed: 0.4 });
  stage.onFrame = (t, dt) => {
    spin(dt);
    pivot.position.y = Math.sin(t * 1.1) * 0.035;
    if (next !== shown) {
      k = Math.max(0, k - dt / FADE);
      setFade(slots[shown], ease(k));
      if (k === 0) shown = next;
    } else if (k < 1) {
      k = Math.min(1, k + dt / FADE);
      setFade(slots[shown], ease(k));
    }
  };

  stage.resize();
  container.classList.add("is-ready");
  return { stage, show, count: slots.length };
}
