// The last section's eye: a fine-line wireframe eyeball in the hero style that
// looks at the cursor. Latitude rings and meridians round the gaze axis, the
// cornea's bulge, an iris of radial fibres round the pupil, and the optic
// nerve at the back (seen when it looks aside). The eyeball turns toward the
// cursor (eased); without a mouse, or once it has gone quiet, it glances
// around by itself (not with reduced motion).

import * as THREE from "three";
import { createStage, cssColor, reducedMotion, trackLines } from "./stage.js";
import { Wire } from "./wire.js";

const V2 = (r, y) => new THREE.Vector2(r, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

const LIMBUS_R = 0.54;                               // iris / cornea edge
const LIMBUS_Y = Math.sqrt(1 - LIMBUS_R ** 2);
const IRIS_Y = LIMBUS_Y - 0.05;
const PUPIL_R = 0.2;
const MAX_TURN = THREE.MathUtils.degToRad(38);
const EASE = 0.09;                                   // s: time constant of the eye following its target
const QUIET = 3500;                                  // ms without pointer movement before it glances around

// Built along +Y (the lathe axis): +Y is where it looks
export function createEye(style) {
  const w = new Wire();
  // Eyeball, open at the front: rings round the gaze axis, meridians from the back pole to the limbus
  const a0 = Math.asin(LIMBUS_R);
  const ball = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI - (Math.PI - a0) * (i / 24);      // from the back pole forward
    ball.push(V2(Math.max(Math.sin(a), 0.0001), Math.cos(a)));
  }
  w.lathe(ball, { ringsAt: [0.18, 0.34, 0.48, 0.6, 0.71, 0.8, 0.88, 0.95], meridians: 24 });
  // Cornea: a clear bulge over the iris, just a couple of rings (not solid: the iris shows through)
  const cornea = [];
  for (let i = 0; i <= 12; i++) {
    const r = LIMBUS_R * (1 - i / 12);
    cornea.push(V2(Math.max(r, 0.0001), LIMBUS_Y + 0.13 * Math.sqrt(1 - (r / LIMBUS_R) ** 2)));
  }
  w.lathe(cornea, { ringsAt: [0.02, 0.35], meridians: 0, solid: false });
  // Iris: radial fibres from the pupil to the limbus, the collarette ring, the pupil
  w.disc({ center: V3(0, IRIS_Y, 0), normal: V3(0, 1, 0), radii: [LIMBUS_R - 0.02, 0.31, PUPIL_R],
    spokes: 40, spokeFrom: PUPIL_R, spokeTo: LIMBUS_R - 0.02, thickness: 0.004 });
  w.disc({ center: V3(0, IRIS_Y + 0.004, 0), normal: V3(0, 1, 0), radii: [PUPIL_R * 0.72, PUPIL_R * 0.42], thickness: 0.002 });
  // Optic nerve, leaving the back a little off-centre
  w.tube(new THREE.CatmullRomCurve3([V3(0.08, -0.9, 0), V3(0.12, -1.2, 0.02), V3(0.2, -1.5, 0.05)]),
    () => 0.14, { rings: 3, lines: 10 });
  return w.build(style);
}

export function initEye(container) {
  const stage = createStage(container, { fov: 22, transparent: true });
  const { scene, camera } = stage;
  const eye = createEye({ color: cssColor("--line"), width: 1.1, ghost: 0.1 });
  eye.rotation.x = Math.PI / 2;                      // +Y (its gaze) → +Z (toward the viewer)
  const pivot = new THREE.Group();                   // turns +Z toward the target
  pivot.add(eye);
  scene.add(pivot);
  trackLines(pivot);

  camera.position.set(0, 0, 7.2);
  camera.lookAt(0, 0, 0);

  // ---- Direction: yaw/pitch now (eased) and wanted (radians)
  const now = { yaw: 0, pitch: 0 };
  const want = { yaw: 0, pitch: 0 };
  let lastPointer = -Infinity, nextGlance = 0;
  const clamp = (v) => Math.max(-MAX_TURN, Math.min(MAX_TURN, v));
  const lookAt = (x, y) => {
    const r = container.getBoundingClientRect();
    const depth = Math.max(r.width, 240) * 1.1;     // how far in front of the screen the eye "is"
    want.yaw = clamp(Math.atan2(x - (r.left + r.width / 2), depth));
    want.pitch = clamp(Math.atan2((r.top + r.height / 2) - y, depth));
    lastPointer = performance.now();
  };
  addEventListener("pointermove", (e) => lookAt(e.clientX, e.clientY), { passive: true });
  addEventListener("pointerdown", (e) => lookAt(e.clientX, e.clientY), { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { lastPointer = -Infinity; });

  stage.onFrame = (t, dt) => {
    const ms = performance.now();
    if (!reducedMotion && ms - lastPointer > QUIET && ms > nextGlance) {
      want.yaw = (Math.random() * 2 - 1) * MAX_TURN * 0.6;
      want.pitch = (Math.random() * 2 - 1) * MAX_TURN * 0.4;
      nextGlance = ms + 1400 + Math.random() * 2200;
    }
    const k = 1 - Math.exp(-dt / EASE);
    now.yaw += (want.yaw - now.yaw) * k;
    now.pitch += (want.pitch - now.pitch) * k;
    pivot.rotation.set(-now.pitch, now.yaw, 0, "YXZ");
  };
  stage.resize();
  container.classList.add("is-ready");
  return stage;
}
