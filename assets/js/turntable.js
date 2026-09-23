// Drag-to-rotate viewer for pre-rendered 360° image sequences.
// Blends neighbouring frames so rotation stays smooth between render steps.
//
// <div data-turntable="assets/img/turntable/cut" data-frames="60"></div>

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function turntable(el) {
  const base = el.dataset.turntable;
  const count = Number(el.dataset.frames);
  const idleSpeed = Number(el.dataset.idleSpeed ?? 14); // degrees per second
  const pad = (i) => String(i).padStart(3, "0");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  el.append(canvas);

  const frames = new Array(count);
  let loaded = 0;
  let angle = 0;          // degrees, frame 0 = 0°
  let velocity = 0;       // degrees per second (inertia)
  let dragging = false;
  let lastX = 0;
  let lastT = 0;
  let idleAfter = 0;      // timestamp after which idle spin resumes
  let onScreen = false;
  let raf = 0;

  // ---- Loading: frame 0 first, then the rest in rotation order
  const load = (i) => new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => { frames[i] = img; loaded++; resolve(); };
    img.onerror = resolve;
    img.src = `${base}/${pad(i)}.webp`;
  });
  load(0).then(() => {
    if (!frames[0]) throw new Error(`turntable: no frames at ${base}`);
    el.classList.add("is-ready");
    draw();
    return Promise.all(Array.from({ length: count - 1 }, (_, i) => load(i + 1)));
  }).then(() => el.classList.add("is-loaded"), (err) => console.warn(err.message));

  // ---- Drawing
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(el.clientWidth * dpr);
    canvas.height = Math.round(el.clientHeight * dpr);
    draw();
  };
  new ResizeObserver(resize).observe(el);

  function nearestLoaded(i) {
    for (let d = 0; d < count; d++) {
      if (frames[(i + d) % count]) return frames[(i + d) % count];
      if (frames[(i - d + count) % count]) return frames[(i - d + count) % count];
    }
    return null;
  }

  function draw() {
    const pos = (((angle % 360) + 360) % 360) / 360 * count;
    const i = Math.floor(pos) % count;
    const f = pos - Math.floor(pos);
    const a = nearestLoaded(i);
    const b = frames[(i + 1) % count];
    if (!a) return;
    const { width: w, height: h } = canvas;
    const s = Math.min(w / a.width, h / a.height);
    const dw = a.width * s, dh = a.height * s, dx = (w - dw) / 2, dy = (h - dh) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = b ? 1 - f : 1;
    ctx.drawImage(a, dx, dy, dw, dh);
    if (b && f > 0.001) {
      ctx.globalCompositeOperation = "lighter"; // (1-f)·A + f·B, premultiplied
      ctx.globalAlpha = f;
      ctx.drawImage(b, dx, dy, dw, dh);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // ---- Motion loop (only while visible)
  let prev = 0;
  function tick(t) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((t - (prev || t)) / 1000, 0.05);
    prev = t;
    if (!dragging) {
      if (Math.abs(velocity) > 0.5) {
        angle += velocity * dt;
        velocity *= Math.exp(-dt * 2.2);           // friction
      } else if (!reducedMotion && t > idleAfter && loaded === count) {
        velocity = 0;
        angle += idleSpeed * dt;
      } else {
        return;                                    // nothing moved; skip redraw
      }
    }
    draw();
  }
  const start = () => { if (!raf) { prev = 0; raf = requestAnimationFrame(tick); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    onScreen ? start() : stop();
  }).observe(el);

  // ---- Pointer: horizontal drag spins; vertical scroll still works on touch
  const degPerPx = () => 360 / Math.max(el.clientWidth * 1.6, 1);
  el.addEventListener("pointerdown", (e) => {
    dragging = true;
    velocity = 0;
    lastX = e.clientX;
    lastT = performance.now();
    el.setPointerCapture(e.pointerId);
    el.classList.add("is-dragging");
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now();
    const d = (e.clientX - lastX) * degPerPx();
    angle += d;                                    // drag right → front turns right
    const dt = Math.max((now - lastT) / 1000, 1 / 240);
    velocity = velocity * 0.6 + (d / dt) * 0.4;
    lastX = e.clientX;
    lastT = now;
    draw();
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    if (performance.now() - lastT > 80) velocity = 0; // held still before letting go
    idleAfter = performance.now() + 2500;
    el.classList.remove("is-dragging");
    if (e.pointerId !== undefined && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    start();
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);

  // ---- Keyboard
  el.tabIndex = 0;
  el.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    velocity = 0;
    angle += (e.key === "ArrowRight" ? 1 : -1) * (360 / count) * 2;
    idleAfter = performance.now() + 3000;
    draw();
  });
}
