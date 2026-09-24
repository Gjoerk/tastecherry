// Drag-to-rotate viewer for pre-rendered 360° image sequences.
// Blends neighbouring frames so rotation stays smooth between render steps.
//
// Frames come either one image per frame (000.webp, 001.webp …) or packed in
// sprite sheets (data-sheet="3x3": sheet-00.webp holds frames 0–8 row by row,
// sheet-01.webp 9–17 …; render/finalize.py sheets). Sheets mean a 360-frame
// turntable is 40 requests, not 360. Loading starts only once the turntable
// nears the screen (the frame-0 file first, then the rest). Files are decoded
// off the main thread into bitmaps, only for the sheets around the current
// angle, so spinning never stalls on a decode and memory stays bounded.
//
// <div data-turntable="assets/img/turntable/cut" data-frames="360" data-sheet="3x3"></div>

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function turntable(el) {
  const base = el.dataset.turntable;
  const count = Number(el.dataset.frames);
  const idleSpeed = Number(el.dataset.idleSpeed ?? 14); // degrees per second
  const pad = (i) => String(i).padStart(3, "0");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  el.append(canvas);

  const [cols, rows] = (el.dataset.sheet ?? "1x1").split("x").map(Number);
  const per = cols * rows;                                   // frames per image
  const images = Math.ceil(count / per);
  const url = (k) => per === 1 ? `${base}/${pad(k)}.webp` : `${base}/sheet-${String(k).padStart(2, "0")}.webp`;

  const frames = new Array(count);  // { sheet, sx, sy, sw, sh } once its file is in
  const blobs = new Array(images);   // compressed files, kept
  const bitmaps = new Map();         // sheet → decoded ImageBitmap (or its promise), only near the current angle
  let size = null;                   // one frame's width/height in its file
  let spinReady = false;  // everything is in: idle spin may start
  let angle = 0;          // degrees, frame 0 = 0°
  let velocity = 0;       // degrees per second (inertia)
  let dragging = false;
  let lastX = 0;
  let lastT = 0;
  let idleAfter = 0;      // timestamp after which idle spin resumes
  let onScreen = false;
  let raf = 0;

  // ---- Loading: when near the screen; the file with frame 0 first. Files are
  // fetched compressed; decoding happens off the main thread (createImageBitmap),
  // so crossing into the next sheet never freezes the page.
  const load = (k) => fetch(url(k)).then((r) => (r.ok ? r.blob() : null)).then(async (blob) => {
    if (!blob) return;
    blobs[k] = blob;
    if (!size) {
      const bm = await createImageBitmap(blob);
      size = { w: bm.width / cols, h: bm.height / rows };
      bitmaps.set(k, bm);
    }
    for (let c = 0; c < per && k * per + c < count; c++) {
      frames[k * per + c] = { sheet: k, sx: (c % cols) * size.w, sy: Math.floor(c / cols) * size.h, sw: size.w, sh: size.h };
    }
  }).catch(() => {});
  const loadAll = async () => {
    await load(0);
    if (!frames[0]) { console.warn(`turntable: no frames at ${base}`); return; }
    el.classList.add("is-ready");
    draw();
    // the rest spread round the circle first (every 8th file, then 4th, 2nd, all)
    const order = [];
    for (const step of [8, 4, 2, 1]) for (let k = 0; k < images; k += step) if (!order.includes(k) && k) order.push(k);
    await Promise.all(order.map((k) => load(k).then(draw)));
    spinReady = true;
    el.classList.add("is-loaded");
  };
  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    near.disconnect();
    loadAll();
  }, { rootMargin: "100% 0px" });
  near.observe(el);

  // Decoded sheets: the one on screen and two either side; the rest are let go
  const WINDOW = 2;
  const bitmap = (k) => {
    const got = bitmaps.get(k);
    if (got instanceof ImageBitmap) return got;
    if (!got && blobs[k]) {
      bitmaps.set(k, createImageBitmap(blobs[k]).then((bm) => {
        if (bitmaps.get(k) instanceof Promise) { bitmaps.set(k, bm); draw(); } else bm.close();
      }, () => bitmaps.delete(k)));
    }
    return null;
  };
  const keepAround = (k) => {
    for (let d = -WINDOW; d <= WINDOW; d++) bitmap((k + d + images) % images);
    for (const [j, bm] of bitmaps) {
      const dist = Math.min(Math.abs(j - k), images - Math.abs(j - k));
      if (dist > WINDOW + 1) { if (bm instanceof ImageBitmap) bm.close(); bitmaps.delete(j); }
    }
  };

  // ---- Drawing
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(el.clientWidth * dpr);
    canvas.height = Math.round(el.clientHeight * dpr);
    draw();
  };
  new ResizeObserver(resize).observe(el);

  // the loaded frames either side of `pos` (in frames), and how far it is between them
  function around(pos) {
    const i = Math.floor(pos) % count;
    let lo = null, hi = null;
    for (let d = 0; d < count; d++) if (frames[(i - d + count) % count]) { lo = i - d; break; }
    if (lo === null) return null;                                  // nothing loaded yet
    for (let d = 1; d <= count; d++) if (frames[(i + d) % count]) { hi = i + d; break; }
    const a = frames[(lo + count) % count], b = frames[hi % count];
    const span = hi - lo;
    return { a, b: b !== a ? b : null, f: span > 0 ? (pos - lo) / span : 0 };
  }

  function draw() {
    const pos = (((angle % 360) + 360) % 360) / 360 * count;
    const pair = around(pos);
    if (!pair) return;
    const { a, f } = pair;
    keepAround(a.sheet);
    const imgA = bitmap(a.sheet);
    if (!imgA) return;                               // decoding off-thread: keep the last frame a moment
    const imgB = pair.b ? bitmap(pair.b.sheet) : null;
    const b = imgB ? pair.b : null;
    const { width: w, height: h } = canvas;
    const s = Math.min(w / a.sw, h / a.sh);
    const dw = a.sw * s, dh = a.sh * s, dx = (w - dw) / 2, dy = (h - dh) / 2;
    const put = (fr, img) => ctx.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, dx, dy, dw, dh);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = b ? 1 - f : 1;
    put(a, imgA);
    if (b && f > 0.001) {
      ctx.globalCompositeOperation = "lighter"; // (1-f)·A + f·B, premultiplied
      ctx.globalAlpha = f;
      put(b, imgB);
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
      } else if (!reducedMotion && t > idleAfter && spinReady) {
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
