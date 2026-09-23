// Shared WebGL stage: renderer, scene, camera, resize and a render loop that
// only runs while the canvas is on screen. Plus studio lighting and drag-to-rotate.

import * as THREE from "three";

export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function cssColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(value);
}

// `transparent`: no painted background, so whatever is behind the canvas
// (e.g. the scroll line) shows through.
export function createStage(container, { fov = 30, shadows = false, transparent = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NoToneMapping; // keeps the canvas background identical to --paper
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = transparent ? null : cssColor("--paper");

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);

  const stage = {
    renderer, scene, camera,
    onResize: null,   // (width, height) => void
    onFrame: null,    // (elapsed, delta) => void
    render() { renderer.render(scene, camera); },
  };

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    stage.onResize?.(w, h);
    if (reducedMotion || !raf) stage.render();
  };

  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 1 / 20);
    stage.onFrame?.(clock.elapsedTime, dt);
    stage.render();
  };
  // With reduced motion the loop still runs, but scenes skip their idle animation
  const start = () => { if (!raf) { clock.getDelta(); loop(); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  let onScreen = false;
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    onScreen && !document.hidden ? start() : stop();
  }).observe(container);
  document.addEventListener("visibilitychange", () => {
    onScreen && !document.hidden ? start() : stop();
  });

  new ResizeObserver(resize).observe(container);
  stage.resize = resize;
  if (new URLSearchParams(location.search).has("debug")) (window.__stages ||= []).push(stage);
  return stage;
}

// Procedural photo "studio": a room of grey `wall` with bright soft boxes.
// Darker walls make reflective materials show crisper facets.
export function studioScene({ wall = 0.55, panels = 6 } = {}) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(12, 8, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(wall, wall, wall), side: THREE.BackSide })
  );
  env.add(room);

  const box = new THREE.PlaneGeometry(1, 1);
  const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(panels, panels, panels), side: THREE.DoubleSide });
  const place = (x, y, z, sx, sy) => {
    const m = new THREE.Mesh(box, light);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, 1);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  place(-3.5, 3.5, 2.5, 3, 2);   // key, upper left
  place(4, 2, 1.5, 1.2, 4);      // strip, right
  place(0, 3.9, -1, 5, 1.2);     // top
  place(-1, -1, 5.5, 2, 1);      // low fill, front
  return env;
}

// Prefiltered environment map for PBR materials.
export function studioEnvironment(renderer, options) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(studioScene(options), 0.02).texture;
  pmrem.dispose();
  return texture;
}

// Drag to rotate `target` (yaw with inertia, limited pitch that springs back),
// arrow keys for keyboard users, and a slow idle spin when left alone.
// Returns an `update(dt)` to call every frame.
export function dragRotate(container, target, { idleSpeed = 0.35, maxPitch = 0.55 } = {}) {
  let dragging = false;
  let lastX = 0, lastY = 0, lastT = 0;
  let yawVel = 0;
  let pitch = 0;
  let idleAt = 0;
  const basePitch = target.rotation.x;

  container.style.cursor = "grab";
  container.style.touchAction = "pan-y"; // keep vertical page scroll on touch
  container.tabIndex = 0;

  container.addEventListener("pointerdown", (e) => {
    dragging = true;
    yawVel = 0;
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    container.setPointerCapture(e.pointerId);
    container.style.cursor = "grabbing";
  });
  container.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now();
    const scale = 5 / Math.max(container.clientWidth, 1); // ~5 rad across the element
    const dx = (e.clientX - lastX) * scale;
    const dy = (e.clientY - lastY) * scale;
    target.rotation.y += dx;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.6, -maxPitch, maxPitch);
    const dt = Math.max((now - lastT) / 1000, 1 / 240);
    yawVel = yawVel * 0.6 + (dx / dt) * 0.4;
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    if (performance.now() - lastT > 80) yawVel = 0; // held still before letting go
    idleAt = performance.now() + 2500;
    container.style.cursor = "grab";
    if (container.hasPointerCapture?.(e.pointerId)) container.releasePointerCapture(e.pointerId);
  };
  container.addEventListener("pointerup", release);
  container.addEventListener("pointercancel", release);
  container.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    yawVel = (e.key === "ArrowRight" ? 1 : -1) * 3;
    idleAt = performance.now() + 3000;
  });

  return (dt) => {
    if (!dragging) {
      if (Math.abs(yawVel) > 0.02) {
        target.rotation.y += yawVel * dt;
        yawVel *= Math.exp(-dt * 2.4);            // friction
      } else if (!reducedMotion && performance.now() > idleAt) {
        target.rotation.y += idleSpeed * dt;
      }
      pitch *= Math.exp(-dt * 2.5);               // spring back to rest
    }
    target.rotation.x = basePitch + pitch;
  };
}
