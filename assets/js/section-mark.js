// A small accent asterisk that marks the section you're in. It sits right
// after that section's label ("02 Cherry on top"; the title itself where a
// section has no label) and, when you scroll into another section, flies
// there with one turn. Its home is the hero footnote's asterisk: it flies out
// of it on the way into the first section and back into it (and fades) when
// you return to the top. It only moves when the active section changes.

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FLIGHT = 1000;   // ms per move

export function sectionMark(main, sections, home) {
  if (!sections.length) return;
  const mark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mark.classList.add("section-mark");
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = '<use href="#asterisk"/>';
  main.append(mark);

  const targets = sections.map((s) => s.querySelector(".section-head > .label") ?? s.querySelector("h2"));
  let active = -1, turns = 0;

  // Page position from layout offsets, so the reveal's 16px rise (a transform) doesn't shift it
  const pageOf = (el) => {
    let x = 0, y = 0;
    for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y };
  };

  // Right after the end of the label's text, centred on its line
  const spot = (el) => {
    const lines = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest("svg") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n; (n = walker.nextNode());) {
      const range = document.createRange();
      range.selectNodeContents(n);
      lines.push(...[...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0));
    }
    const box = el.getBoundingClientRect();
    // the last line: rects whose middle is below every other rect's middle band
    // (an italic <em> sits a few px lower than the grotesk, but on the same line)
    const mid = (r) => (r.top + r.bottom) / 2;
    const lowest = lines.reduce((a, r) => (mid(r) > mid(a) ? r : a), lines[0] ?? box);
    const onLast = lines.filter((r) => mid(r) > lowest.top && mid(r) < lowest.bottom);
    const last = onLast.reduce((a, r) => (r.right > a.right ? r : a), onLast[0] ?? box);
    const size = parseFloat(getComputedStyle(el).fontSize) * 0.85;
    const at = pageOf(el), origin = pageOf(main);
    return {
      x: at.x - origin.x + (last.right - box.left) + size * 0.35,
      y: at.y - origin.y + (last.top - box.top) + (last.height - size) / 2,
      size,
    };
  };

  // The hero footnote's asterisk, where the mark lives while you're at the top
  // (an svg has no offsetLeft/Top, and this one never moves: use its box)
  const homeSpot = () => {
    const r = home.getBoundingClientRect(), m = main.getBoundingClientRect();
    return { x: r.left - m.left, y: r.top - m.top, size: r.width };
  };

  const place = (animate) => {
    const { x, y, size } = active < 0 ? homeSpot() : spot(targets[active]);
    const fly = animate && !reducedMotion;
    // leaving home: show at once and fly; going home: fly, then fade into the footnote mark
    mark.style.transition = !fly ? "none"
      : active < 0 ? `transform ${FLIGHT}ms var(--ease-in-out), width ${FLIGHT}ms var(--ease-in-out), height ${FLIGHT}ms var(--ease-in-out), opacity 150ms ${FLIGHT - 150}ms`
      : `transform ${FLIGHT}ms var(--ease-in-out), width ${FLIGHT}ms var(--ease-in-out), height ${FLIGHT}ms var(--ease-in-out), opacity 0ms`;
    mark.style.width = mark.style.height = `${size}px`;
    mark.style.transform = `translate(${x}px, ${y}px) rotate(${turns * 360}deg)`;
    mark.style.opacity = active < 0 ? 0 : 1;
    if (!fly) { mark.getBoundingClientRect(); mark.style.transition = ""; }
  };

  const update = (animate = true) => {
    const line = scrollY + innerHeight * 0.4;
    let now = -1;
    sections.forEach((s, i) => { if (pageOf(s).y <= line) now = i; });
    // at the very bottom the last section is the one you're reading, even when a
    // tall screen can't scroll its top up to the 40% line
    if (scrollY >= document.documentElement.scrollHeight - innerHeight - 2) now = sections.length - 1;
    if (now === active) return;
    turns += now > active ? 1 : -1;                 // one turn per move, either direction
    active = now;
    place(animate);
  };

  let raf = 0;
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  const relayout = () => place(false);
  new ResizeObserver(relayout).observe(document.body);
  document.fonts?.ready.then(relayout);
  addEventListener("langchange", relayout);      // labels change length
  place(false);          // start at home, hidden
  update(false);         // already scrolled down on load? sit there without flying
}
