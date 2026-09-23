// A thin accent line snaking down the page behind everything. It starts at the
// hero footnote and grows as you scroll: when a section arrives at
// the top of the screen (where the nav links land), the line's end has just
// reached that section's title; scroll on and it draws on to the next one.
//
// Geometry: from each title it drops straight down the left margin, snakes
// across the page in the gap between sections, and comes down onto the next
// title from above-left of its label, so it stays out of the copy.

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVG = "http://www.w3.org/2000/svg";

export function scrollLine(main, { start, titles }) {
  if (!start || !titles.length) return;

  const svg = document.createElementNS(SVG, "svg");
  svg.classList.add("scroll-line");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG, "path");
  const probe = document.createElementNS(SVG, "path");   // measures partial lengths
  probe.style.visibility = "hidden";
  svg.append(path, probe);
  main.prepend(svg);

  let stops = [];       // [{ scroll, length }], increasing
  let total = 0;

  // Page position of an element from its layout offsets, so the reveal's
  // 16px rise (a transform) doesn't shift the targets
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
    const W = main.clientWidth;
    svg.setAttribute("width", W);
    svg.setAttribute("height", main.scrollHeight);
    svg.setAttribute("viewBox", `0 0 ${W} ${main.scrollHeight}`);

    const s = start.getBoundingClientRect();
    const pts = [{ x: s.left + scrollX + s.width / 2 - origin.x, y: s.bottom + scrollY - origin.y + 10 }, ...titles.map((t) => touchPoint(t, origin))];

    // Each hop, A → B: move to the left margin (if A is centred) and drop straight
    // down beside A's content; snake across the page inside the gap between the
    // two sections; come back left above B's label and drop onto the title.
    const margin = Math.min(...pts.slice(1).map((p) => p.x));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const section = titles[i - 1].closest("section") ?? titles[i - 1];
      const top = pageOf(section).y - origin.y;                                  // B's section starts here
      const gapAbove = parseFloat(getComputedStyle(section).paddingTop) || 100;   // B's top padding
      const prev = section.previousElementSibling;
      const gapBelow = prev ? parseFloat(getComputedStyle(prev).paddingBottom) || 100 : 100;
      const label = titles[i - 1].previousElementSibling;
      const labelTop = label ? pageOf(label).y - origin.y : b.y - 40;

      // 1. to the margin and down A's side (skipped for the start and when already there)
      let x = a.x, y = a.y;
      if (i > 1 && a.x > margin + 12) {
        d += ` C ${a.x} ${a.y + 60}, ${margin} ${a.y + 20}, ${margin} ${a.y + 90}`;
        x = margin; y = a.y + 90;
      }
      const turn = Math.max(y, top - gapBelow * 0.8);
      if (turn > y) d += ` L ${x} ${turn}`;

      // 2. across the gap: out to the right, crossing the hairline between sections
      const m = { x: W * (i % 2 ? 0.72 : 0.6), y: Math.max(turn + 40, top + gapAbove * 0.1) };
      const v = (m.y - turn) * 0.6;
      d += ` C ${x} ${turn + v}, ${m.x} ${m.y - v}, ${m.x} ${m.y}`;

      // 3. back left above the label, then a short drop onto the title
      const e = { x: b.x - 14, y: Math.max(m.y + 30, labelTop - 16) };
      d += ` C ${m.x} ${m.y + (e.y - m.y) * 0.6}, ${e.x} ${e.y - (e.y - m.y) * 0.6}, ${e.x} ${e.y}`;
      d += ` C ${e.x} ${e.y + (b.y - e.y) * 0.5}, ${b.x - 6} ${b.y - 6}, ${b.x} ${b.y}`;
      segs.push(d);
    }
    path.setAttribute("d", d);
    total = path.getTotalLength();
    path.style.strokeDasharray = `${total} ${total}`;

    // Scroll positions at which each title should be reached
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    stops = [{ scroll: 0, length: Math.min(60, total) }];
    segs.forEach((partial, i) => {
      probe.setAttribute("d", partial);
      const section = titles[i].closest("section") ?? titles[i];
      const at = Math.min(pageOf(section).y - pad, maxScroll);
      stops.push({ scroll: Math.max(at, stops[stops.length - 1].scroll + 1), length: probe.getTotalLength() });
    });
    draw();
  };

  const draw = () => {
    if (reducedMotion) { path.style.strokeDashoffset = 0; return; }
    const y = scrollY;
    let len = stops[stops.length - 1].length;
    for (let i = 1; i < stops.length; i++) {
      if (y <= stops[i].scroll) {
        const a = stops[i - 1], b = stops[i];
        const t = Math.max(0, (y - a.scroll) / (b.scroll - a.scroll));
        len = a.length + (b.length - a.length) * t;
        break;
      }
    }
    path.style.strokeDashoffset = total - len;
  };

  let raf = 0;
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }, { passive: true });
  let pending = 0;
  const relayout = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(layout); };
  new ResizeObserver(relayout).observe(document.body);
  document.fonts?.ready.then(relayout);
  addEventListener("load", relayout);
  layout();
}
