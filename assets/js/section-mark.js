// A small accent asterisk that marks the section you're in: it sits right
// after that section's title (raised, like the hero's footnote mark) and, when
// you scroll into the next section, flies there with one turn. It only moves
// when the active section changes. Hidden over the hero.

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function sectionMark(main, titles) {
  if (!titles.length) return;
  const mark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mark.classList.add("section-mark");
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = '<use href="#asterisk"/>';
  main.append(mark);

  let active = -1, turns = 0;

  // Page position from layout offsets, so the reveal's 16px rise (a transform) doesn't shift it
  const pageOf = (el) => {
    let x = 0, y = 0;
    for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y };
  };

  // Just after the end of the title's last line, near its top
  const spot = (title) => {
    // text only (a title may hold decoration, like the brush under "It's Simple")
    const lines = [];
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest("svg") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n; (n = walker.nextNode());) {
      const range = document.createRange();
      range.selectNodeContents(n);
      lines.push(...[...range.getClientRects()].filter((r) => r.width > 0));
    }
    const box = title.getBoundingClientRect();
    const last = lines[lines.length - 1] ?? box;
    const size = parseFloat(getComputedStyle(title).fontSize) * 0.42;
    const at = pageOf(title), origin = pageOf(main);
    return {
      x: at.x - origin.x + (last.right - box.left) + size * 0.2,
      y: at.y - origin.y + (last.top - box.top) + size * 0.1,
      size,
    };
  };

  const place = (animate) => {
    const i = Math.max(active, 0);
    const { x, y, size } = spot(titles[i]);
    mark.style.transition = animate && !reducedMotion ? "" : "none";
    mark.style.width = mark.style.height = `${size}px`;
    mark.style.transform = `translate(${x}px, ${y}px) rotate(${turns * 360}deg)`;
    mark.style.opacity = active < 0 ? 0 : 1;
    if (!animate) { mark.getBoundingClientRect(); mark.style.transition = ""; }
  };

  const update = () => {
    const line = scrollY + innerHeight * 0.4;
    let now = -1;
    titles.forEach((t, i) => { if (pageOf(t.closest("section") ?? t).y <= line) now = i; });
    if (now === active) return;
    const first = active < 0;
    if (now >= 0 && !first) turns += now > active ? 1 : -1;    // one turn per hop, either direction
    active = now;
    place(!first);
  };

  let raf = 0;
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  const relayout = () => place(false);
  new ResizeObserver(relayout).observe(document.body);
  document.fonts?.ready.then(relayout);
  update();
  place(false);
}
