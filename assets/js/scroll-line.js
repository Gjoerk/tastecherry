// A thin accent line snaking down the page behind everything. It starts under
// the hero footnote and draws itself as you scroll: its end rides at a steady
// height on screen, and when a section lands at the top (where the nav links
// go) the end has just reached that section's title.
//
// Geometry: from each title it drops straight down the left margin, snakes
// across the page in the gap between sections, and comes down onto the next
// title from above-left of its label, so it stays out of the copy.
//
// Drawing: one <path> per hop, so a scroll frame only repaints the hop that is
// growing. How much is drawn is found from the scroll position by height (the
// end follows the screen), not by length, so the sideways stretches sweep
// across quickly instead of racing the end out of view.

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVG = "http://www.w3.org/2000/svg";
const STEP = 3;   // px of path length between height samples

export function scrollLine(main, { start, titles }) {
  if (!start || !titles.length) return;

  const svg = document.createElementNS(SVG, "svg");
  svg.classList.add("scroll-line");
  svg.setAttribute("aria-hidden", "true");
  main.prepend(svg);

  let hops = [];        // [{ el, length, ys: heights along the hop (non-decreasing), shown }]
  let anchors = [];     // [{ scroll, offset }]: the end's page y = scroll + offset
  let top = 0;          // main's page y

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
    top = origin.y;
    const W = main.clientWidth, H = main.scrollHeight;
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();

    const s = start.getBoundingClientRect();
    const pts = [{ x: s.left + scrollX + s.width / 2 - origin.x, y: s.bottom + scrollY - origin.y + 10 }, ...titles.map((t) => touchPoint(t, origin))];
    const margin = Math.min(...pts.slice(1).map((p) => p.x));

    hops = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const section = titles[i - 1].closest("section") ?? titles[i - 1];
      const secTop = pageOf(section).y - origin.y;                              // B's section starts here
      const gapAbove = parseFloat(getComputedStyle(section).paddingTop) || 100;
      const prev = section.previousElementSibling;
      const gapBelow = prev ? parseFloat(getComputedStyle(prev).paddingBottom) || 100 : 100;
      const label = titles[i - 1].previousElementSibling;
      const labelTop = label ? pageOf(label).y - origin.y : b.y - 40;

      let d = `M ${a.x} ${a.y}`, x = a.x, y = a.y;
      // 1. to the margin (if A is centred) and down A's side
      if (i > 1 && a.x > margin + 12) {
        d += ` C ${a.x} ${a.y + 60}, ${margin} ${a.y + 20}, ${margin} ${a.y + 90}`;
        x = margin; y = a.y + 90;
      }
      const turn = Math.max(y, secTop - gapBelow * 0.8);
      if (turn > y) d += ` L ${x} ${turn}`;
      // 2. across the gap between the sections
      const m = { x: W * (i % 2 ? 0.72 : 0.6), y: Math.max(turn + 40, secTop + gapAbove * 0.1) };
      const v = (m.y - turn) * 0.6;
      d += ` C ${x} ${turn + v}, ${m.x} ${m.y - v}, ${m.x} ${m.y}`;
      // 3. back left above the label, then a short drop onto the title
      const e = { x: b.x - 14, y: Math.max(m.y + 30, labelTop - 16) };
      d += ` C ${m.x} ${m.y + (e.y - m.y) * 0.6}, ${e.x} ${e.y - (e.y - m.y) * 0.6}, ${e.x} ${e.y}`;
      d += ` C ${e.x} ${e.y + (b.y - e.y) * 0.5}, ${b.x - 6} ${b.y - 6}, ${b.x} ${b.y}`;

      const el = document.createElementNS(SVG, "path");
      el.setAttribute("d", d);
      svg.append(el);
      const length = el.getTotalLength();
      el.style.strokeDasharray = `${length} ${length}`;
      el.style.strokeDashoffset = length;
      // heights along the hop, made non-decreasing so "how far down" has one answer
      const ys = new Float32Array(Math.ceil(length / STEP) + 1);
      let hi = -Infinity;
      for (let k = 0; k < ys.length; k++) ys[k] = hi = Math.max(hi, el.getPointAtLength(Math.min(k * STEP, length)).y);
      hops.push({ el, length, ys, shown: -1 });
    }

    // At scroll 0 the end sits a little under the footnote; at each section's
    // landing scroll it sits on that title. In between it glides.
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    anchors = [{ scroll: 0, offset: Math.min(pts[0].y + top + 48, innerHeight - 10) }];   // a short stub shows on load
    titles.forEach((t, i) => {
      const section = t.closest("section") ?? t;
      const at = Math.max(Math.min(pageOf(section).y - pad, maxScroll), anchors[i].scroll + 1);
      anchors.push({ scroll: at, offset: pts[i + 1].y + top - at });
    });
    draw();
  };

  // Length along a hop at which it first reaches height y (binary search)
  const lengthAt = (h, y) => {
    const ys = h.ys;
    if (y <= ys[0]) return 0;
    if (y >= ys[ys.length - 1]) return h.length;
    let lo = 0, hi = ys.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; ys[mid] < y ? (lo = mid) : (hi = mid); }
    const f = (y - ys[lo]) / Math.max(ys[hi] - ys[lo], 1e-6);
    return Math.min(h.length, (lo + f) * STEP);
  };

  const draw = () => {
    if (!hops.length) return;
    let target = Infinity;                                   // height (in main) the end reaches
    if (!reducedMotion) {
      const y = scrollY;
      let offset = anchors[anchors.length - 1].offset;
      for (let i = 1; i < anchors.length; i++) {
        if (y <= anchors[i].scroll) {
          const a = anchors[i - 1], b = anchors[i];
          offset = a.offset + (b.offset - a.offset) * Math.max(0, (y - a.scroll) / (b.scroll - a.scroll));
          break;
        }
      }
      target = y + offset - top;
    }
    for (const h of hops) {
      const len = lengthAt(h, target);
      if (Math.abs(len - h.shown) < 0.5) continue;          // unchanged: no repaint
      h.shown = len;
      h.el.style.strokeDashoffset = h.length - len;
    }
  };

  let raf = 0;
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }, { passive: true });
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
