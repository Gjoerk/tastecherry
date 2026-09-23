// A thin accent line drawn down the page behind everything, like a pencil
// stroke that follows you. It starts under the hero footnote; when a section
// lands at the top (where the nav links go) the stroke has just reached that
// section's title, and scrolling on draws it on to the next one.
//
// Geometry: one smooth, organic curve behind the content. Between titles it
// swings across the page a few times (always off to the right first, then
// alternating, slightly irregular), and comes in from the upper left to touch
// the next title.
//
// Motion: the scroll position sets how far along the curve the stroke should
// be (by length, so its speed along the curve is even); the tip then eases
// toward that point every frame, so it glides like a pencil instead of
// jumping with each wheel step. One <path> per hop, and hops that haven't
// started are hidden (a round cap would otherwise leave a dot).

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVG = "http://www.w3.org/2000/svg";
const EASE = 4.5; // how quickly the tip catches up (per second); lower = lazier pencil

export function scrollLine(main, { start, titles }) {
  if (!start || !titles.length) return;

  const svg = document.createElementNS(SVG, "svg");
  svg.classList.add("scroll-line");
  svg.setAttribute("aria-hidden", "true");
  main.prepend(svg);

  let hops = [];        // [{ el, from (cumulative length at its start), length, shown }]
  let anchors = [];     // [{ scroll, length }]: how much is drawn at that scroll position
  let current = 0;      // drawn length right now (eases toward the target)

  // Page position from layout offsets, so the reveal's 16px rise (a transform)
  // doesn't shift the targets
  const pageOf = (el) => {
    let x = 0, y = 0;
    for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y };
  };

  // Where the line touches a title: against its first letter, halfway down the first line
  const touchPoint = (el, origin) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const box = el.getBoundingClientRect();
    const line = [...range.getClientRects()].find((r) => r.width > 0) ?? box;
    const at = pageOf(el);
    return { x: at.x + (line.left - box.left) - origin.x - 4, y: at.y + (line.top - box.top) + line.height * 0.55 - origin.y };
  };

  const layout = () => {
    const origin = pageOf(main);
    const W = main.clientWidth, H = main.scrollHeight;
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();

    const s = start.getBoundingClientRect();
    const pts = [{ x: s.left + scrollX + s.width / 2 - origin.x, y: s.bottom + scrollY - origin.y + 10 }, ...titles.map((t) => touchPoint(t, origin))];

    // Route: swing points spread evenly down each hop (so length grows evenly
    // with height), first always to the right of the title just touched.
    const swings = [[0.8, 0.3, 0.66], [0.76, 0.24, 0.6], [0.86, 0.36, 0.7], [0.72, 0.2, 0.56]];
    const wobble = (i, k) => Math.sin(i * 2.3 + k * 1.7) * 0.035;       // deterministic, organic
    const route = [pts[0]];
    const hopEnds = [];                                                   // index of each title in `route`
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dy = b.y - a.y;
      const first = Math.max(swings[(i - 1) % swings.length][0], a.x / W + 0.25);
      // short hops (the hero to the first title) get one swing, long ones three
      const xs = dy < 600 ? [first] : [first, ...swings[(i - 1) % swings.length].slice(1)];
      const ys = dy < 600 ? [0.45] : [0.24, 0.5, 0.76];
      xs.forEach((fx, k) => {
        route.push({ x: W * Math.min(0.9, fx + wobble(i, k)), y: a.y + dy * (ys[k] + wobble(i, k) * 0.4) });
      });
      route.push({ x: Math.max(8, b.x - 70), y: b.y - Math.min(150, dy * 0.12) });   // in from the upper left
      route.push(b);
      hopEnds.push(route.length - 1);
    }

    // Smooth curve through every point: cubic pieces whose handles follow the
    // neighbours and scale with the gaps, so it bends softly without loops.
    const ghost = (k) => (k < 0 ? { x: route[0].x, y: route[0].y - 60 }
      : k >= route.length ? { x: route[route.length - 1].x + 60, y: route[route.length - 1].y + 40 } : route[k]);
    const piece = (k) => {
      const p0 = ghost(k - 1), p1 = route[k], p2 = route[k + 1], p3 = ghost(k + 2);
      const d1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const t1 = d1 / (Math.hypot(p2.x - p0.x, p2.y - p0.y) || 1) / 1.6;
      const t2 = d1 / (Math.hypot(p3.x - p1.x, p3.y - p1.y) || 1) / 1.6;
      const c1 = { x: p1.x + (p2.x - p0.x) * t1, y: p1.y + (p2.y - p0.y) * t1 };
      const c2 = { x: p2.x - (p3.x - p1.x) * t2, y: p2.y - (p3.y - p1.y) * t2 };
      return ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
    };

    hops = [];
    let from = 0, sum = 0;
    for (const to of hopEnds) {
      let d = `M ${route[from].x} ${route[from].y}`;
      for (let k = from; k < to; k++) d += piece(k);
      from = to;
      const el = document.createElementNS(SVG, "path");
      el.setAttribute("d", d);
      svg.append(el);
      const length = el.getTotalLength();
      el.style.strokeDasharray = `${length} ${length}`;
      hops.push({ el, from: sum, length, shown: -1 });
      sum += length;
    }

    // At scroll 0 a short stub shows; at each section's landing scroll the
    // stroke has reached that title. In between, length follows scroll evenly.
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    anchors = [{ scroll: 0, length: Math.min(50, hops[0].length) }];
    titles.forEach((t, i) => {
      const section = t.closest("section") ?? t;
      const at = Math.max(Math.min(pageOf(section).y - pad, maxScroll), anchors[i].scroll + 1);
      anchors.push({ scroll: at, length: hops[i].from + hops[i].length });
    });
    current = target();      // no catch-up animation after a re-layout
    paint();
  };

  const target = () => {
    if (reducedMotion) return Infinity;
    const y = scrollY;
    for (let i = 1; i < anchors.length; i++) {
      if (y <= anchors[i].scroll) {
        const a = anchors[i - 1], b = anchors[i];
        return a.length + (b.length - a.length) * Math.max(0, (y - a.scroll) / (b.scroll - a.scroll));
      }
    }
    return anchors[anchors.length - 1].length;
  };

  const paint = () => {
    for (const h of hops) {
      const len = Math.max(0, Math.min(h.length, current - h.from));
      if (Math.abs(len - h.shown) < 0.25) continue;          // unchanged: no repaint
      h.shown = len;
      h.el.style.visibility = len > 0.5 ? "visible" : "hidden";
      h.el.style.strokeDashoffset = h.length - len;
    }
  };

  // Pencil motion: ease the tip toward the target, frame by frame, until it's there
  let raf = 0, last = 0;
  const tick = (now) => {
    const dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    const goal = target();
    current += (goal - current) * (1 - Math.exp(-EASE * dt));
    if (Math.abs(goal - current) < 0.5) current = goal;
    paint();
    raf = current === goal ? 0 : requestAnimationFrame(tick);
    if (!raf) last = 0;
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener("scroll", wake, { passive: true });

  let pending = 0;
  const relayout = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(layout); };
  new ResizeObserver(relayout).observe(document.body);
  // Phone toolbars resize the viewport's height while scrolling: only a width
  // change is worth a full re-layout mid-scroll
  let lastWidth = innerWidth;
  addEventListener("resize", () => { if (innerWidth !== lastWidth) { lastWidth = innerWidth; relayout(); } });
  document.fonts?.ready.then(relayout);
  addEventListener("load", relayout);
  layout();
}
