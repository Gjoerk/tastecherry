// An eye that looks at the cursor, from a grid of pre-rendered gaze frames
// (render/eye.py). The grid spans ±yaw by ±pitch degrees; frame i = row·cols + col,
// row 0 looks up, col 0 looks to the viewer's left. The four frames around the
// wanted direction are blended, and the direction eases toward its target.
// Without a mouse (or when it's gone quiet) the eye glances around by itself.
//
// <div data-gaze="assets/img/eye"></div>   (frames 000.webp… + grid.json)

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = 0.09;        // s: time constant of the eye following its target
const QUIET = 3500;       // ms without pointer movement before it glances around

export async function gaze(el) {
  const base = el.dataset.gaze;
  const grid = await fetch(`${base}/grid.json`).then((r) => r.json());
  const { cols, rows, yaw: YAW, pitch: PITCH } = grid;
  const count = cols * rows;
  const pad = (i) => String(i).padStart(3, "0");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  el.append(canvas);

  // ---- Loading: straight ahead first, then outward
  const frames = new Array(count);
  const load = (i) => new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => { frames[i] = img; resolve(); };
    img.onerror = resolve;
    img.src = `${base}/${pad(i)}.webp`;
  });
  const cr = (rows - 1) / 2, cc = (cols - 1) / 2;
  const order = [...Array(count).keys()].sort((a, b) =>
    Math.hypot(Math.floor(a / cols) - cr, (a % cols) - cc) - Math.hypot(Math.floor(b / cols) - cr, (b % cols) - cc));
  const shown = () => { if (!el.classList.contains("is-ready")) { el.classList.add("is-ready"); draw(); } };
  load(order[0]).then(() => {
    if (frames[order[0]]) shown();
    return Promise.all(order.slice(1).map((i) => load(i).then(() => frames[i] && shown())));
  }).then(() => { if (!frames.some(Boolean)) console.warn(`gaze: no frames at ${base}`); });

  // ---- Direction: where it looks (eased) and where it wants to look (degrees)
  const now = { yaw: 0, pitch: 0 };
  const want = { yaw: 0, pitch: 0 };
  let lastPointer = -Infinity;
  let nextGlance = 0;

  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  const lookAt = (x, y) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.47;   // eye centre in the frame
    const depth = Math.max(r.width, 240) * 1.1;                        // how far "in front" the viewer sits
    want.yaw = clamp(Math.atan2(x - cx, depth) * 180 / Math.PI, YAW);
    want.pitch = clamp(Math.atan2(cy - y, depth) * 180 / Math.PI, PITCH);
    lastPointer = performance.now();
    start();
  };
  addEventListener("pointermove", (e) => lookAt(e.clientX, e.clientY), { passive: true });
  addEventListener("pointerdown", (e) => lookAt(e.clientX, e.clientY), { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { lastPointer = -Infinity; });

  // ---- Drawing: bilinear blend of the four nearest frames
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(el.clientWidth * dpr);
    canvas.height = Math.round(el.clientHeight * dpr);
    draw();
  };
  new ResizeObserver(resize).observe(el);

  function nearestLoaded(r, c) {
    let best = null, bestD = Infinity;
    frames.forEach((f, i) => {
      if (!f) return;
      const d = Math.hypot(Math.floor(i / cols) - r, (i % cols) - c);
      if (d < bestD) { bestD = d; best = f; }
    });
    return best;
  }

  function draw() {
    const fc = (now.yaw + YAW) / (2 * YAW) * (cols - 1);
    const fr = (PITCH - now.pitch) / (2 * PITCH) * (rows - 1);
    const c0 = Math.min(Math.floor(fc), cols - 2), r0 = Math.min(Math.floor(fr), rows - 2);
    const u = fc - c0, v = fr - r0;
    const parts = [
      [r0, c0, (1 - u) * (1 - v)], [r0, c0 + 1, u * (1 - v)],
      [r0 + 1, c0, (1 - u) * v], [r0 + 1, c0 + 1, u * v],
    ].filter(([, , w]) => w > 0.002);
    let layers = parts.map(([r, c, w]) => [frames[r * cols + c], w]);
    if (layers.some(([f]) => !f)) {                  // still loading: show the closest we have
      const f = nearestLoaded(fr, fc);
      if (!f) return;
      layers = [[f, 1]];
    }
    const total = layers.reduce((s, [, w]) => s + w, 0);
    const first = layers[0][0];
    const { width: w, height: h } = canvas;
    const s = Math.min(w / first.width, h / first.height);
    const dw = first.width * s, dh = first.height * s, dx = (w - dw) / 2, dy = (h - dh) / 2;
    ctx.clearRect(0, 0, w, h);
    layers.forEach(([f, wt], i) => {
      ctx.globalCompositeOperation = i ? "lighter" : "source-over";   // Σ wᵢ·frameᵢ, premultiplied
      ctx.globalAlpha = wt / total;
      ctx.drawImage(f, dx, dy, dw, dh);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // ---- Motion loop (only while on screen)
  let raf = 0, prev = 0, onScreen = false;
  function tick(t) {
    raf = 0;
    const dt = Math.min((t - (prev || t)) / 1000, 0.05);
    prev = t;
    if (!reducedMotion && t - lastPointer > QUIET && t > nextGlance) {
      // a glance: somewhere within the middle of its range, then hold a while
      want.yaw = (Math.random() * 2 - 1) * YAW * 0.6;
      want.pitch = (Math.random() * 2 - 1) * PITCH * 0.5;
      nextGlance = t + 1400 + Math.random() * 2200;
    }
    const k = 1 - Math.exp(-dt / EASE);
    const moving = Math.abs(want.yaw - now.yaw) + Math.abs(want.pitch - now.pitch) > 0.02;
    now.yaw += (want.yaw - now.yaw) * k;
    now.pitch += (want.pitch - now.pitch) * k;
    if (moving) draw();
    if (onScreen && (moving || !reducedMotion)) start();
    else prev = 0;
  }
  function start() { if (onScreen && !raf) raf = requestAnimationFrame(tick); }
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) start(); else { cancelAnimationFrame(raf); raf = 0; prev = 0; }
  }).observe(el);
}
