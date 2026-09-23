// Before/after slider: drag anywhere on the frame (or use the arrow keys on
// the range input) to move the divider. Sets --pos on the frame.
//
// <figure data-compare><div class="compare__frame">…<input class="compare__range" type="range">

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function compare(root) {
  const frame = root.querySelector(".compare__frame");
  const range = root.querySelector(".compare__range");
  let dragging = false;
  let startX = 0, startY = 0;
  let decided = false;   // on touch: wait to see if the gesture is a scroll or a drag

  const set = (pct) => {
    pct = Math.min(100, Math.max(0, pct));
    frame.style.setProperty("--pos", `${pct}%`);
    range.value = Math.round(pct);
  };
  const fromEvent = (e) => {
    const r = frame.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100);
  };

  frame.addEventListener("pointerdown", (e) => {
    dragging = true;
    decided = e.pointerType !== "touch";
    startX = e.clientX; startY = e.clientY;
    if (decided) { frame.setPointerCapture(e.pointerId); fromEvent(e); root.classList.add("is-dragging"); }
  });
  frame.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (!decided) {
      const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
      if (dx < 6 && dy < 6) return;
      decided = true;
      if (dy > dx) { dragging = false; return; }       // vertical: let the page scroll
      frame.setPointerCapture(e.pointerId);
      root.classList.add("is-dragging");
    }
    fromEvent(e);
  });
  const release = (e) => {
    if (dragging && !decided) fromEvent(e);             // a plain tap moves the divider there
    dragging = false;
    root.classList.remove("is-dragging");
  };
  frame.addEventListener("pointerup", release);
  frame.addEventListener("pointercancel", () => { dragging = false; root.classList.remove("is-dragging"); });

  range.addEventListener("input", () => set(Number(range.value)));

  // One slow sweep the first time it scrolls into view, so it reads as draggable
  if (reducedMotion) return;
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    let touched = false;
    frame.addEventListener("pointerdown", () => { touched = true; }, { once: true });
    const t0 = performance.now() + 600, dur = 1800;
    const step = (t) => {
      if (touched) return;
      const k = Math.min(Math.max((t - t0) / dur, 0), 1);
      set(50 - 18 * Math.sin(k * Math.PI * 2) * (1 - k));   // eases out back to 50
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { threshold: 0.5 });
  io.observe(frame);
}
