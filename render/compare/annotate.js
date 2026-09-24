// Red-pen markup over ai.html: circles, underlines and scribbled notes on
// everything that screams "AI made this". Injected by shoot.js together with
// rough.js (window.rough) and the Caveat font; not loaded by the site itself.
//
// Each note: marks on targets (selector, or [selector, "word"] for one word),
// a note position in px from the top left of the viewport, and an arrow from
// the note to the first mark.

(() => {
  const INK = "#CE0058";          // --accent, the site's red pen
  const mobile = innerWidth < 700;

  // Phones: no margins to write in, so open up the gaps between blocks
  // (screenshot only) and place notes relative to the block above them.
  if (mobile) {
    const style = document.createElement("style");
    style.textContent = `
      header { padding-top: 124px; }
      .pill { margin-bottom: 66px; }
      h1 { margin-bottom: 78px; }
      header p { margin-bottom: 70px; }
      .cards { margin-top: 40px; }`;
    document.head.append(style);
  }
  const R = (sel) => document.querySelector(sel).getBoundingClientRect();

  const NOTES = mobile ? [
    { marks: [["circle", ".logo"]], at: () => [16, R("nav").bottom + 54], rot: -4, text: "emoji + gradient\nlogo. bold choice." },
    { marks: [["circle", "nav .btn"]], at: () => [262, R("nav").bottom + 58], rot: 4, text: "shitty\nbutton #1" },
    { marks: [["circle", ".pill"]], at: () => [118, R(".pill").bottom + 50], rot: -3, text: "✨ = AI was here" },
    { marks: [["wave", ["h1 span", "Perfect"]], ["wave", ["h1 span", "Cup"]]], at: () => [214, R("h1").bottom + 40], rot: 4, text: "gradient text.\nInter. again.", arrow: false },
    { marks: [["under", ["header p", "Elevate"]], ["under", ["header p", "seamless"]], ["under", ["header p", "Supercharge"]]],
      at: () => [80, R("header p").bottom + 44], rot: -2, text: "buzzword bingo! 3/3", arrow: false },
    { marks: [["box", ".ctas .btn"]], at: () => [50, R(".ctas").bottom + 48], rot: 3, text: "shitty buttons (rocket incl.)", arrow: false },
  ] : [
    { marks: [["circle", ".logo"]], at: [52, 150], rot: -4, text: "emoji + gradient logo.\nbold choice." },
    { marks: [["circle", "nav .btn"]], at: [1040, 158], rot: 4, text: "shitty button #1" },
    { marks: [["circle", ".pill"]], at: [860, 214], rot: 3, text: "✨ sparkles = AI was here" },
    { marks: [["wave", "h1 span"]], at: [936, 336], rot: 4, text: "gradient text.\nin Inter. again.",
      tip: () => { const r = R("h1 span"); return [r.right - 70, r.bottom + 10]; } },
    { marks: [["under", ["header p", "Elevate"]], ["under", ["header p", "seamless"]], ["under", ["header p", "Supercharge"]]],
      at: [70, 420], rot: -3, text: "buzzword bingo!\n3/3", arrow: "Elevate" },
    { marks: [["box", ".ctas .btn"]], at: [880, 505], rot: 3, text: "shitty buttons\n(rocket included, free)" },
    { marks: [["circle", ".card:first-child .icon"]], at: [36, 548], rot: -4, text: "3 rounded cards,\ndrop shadows, emoji\nin a box. every. time." },
  ];

  // ---------------------------------------------------------------- geometry
  const rectOf = (target) => {
    if (typeof target === "string") {
      // union of every match, so ".ctas .btn" boxes both buttons, not their full-width row
      const rs = [...document.querySelectorAll(target)].map((el) => el.getBoundingClientRect());
      const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top));
      const right = Math.max(...rs.map((r) => r.right)), bottom = Math.max(...rs.map((r) => r.bottom));
      return new DOMRect(x, y, right - x, bottom - y);
    }
    const [sel, word] = target;
    const el = document.querySelector(sel);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      const i = n.data.indexOf(word);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i); r.setEnd(n, i + word.length);
      return r.getBoundingClientRect();
    }
    throw new Error(`"${word}" not found in ${sel}`);
  };

  // ------------------------------------------------------------------ canvas
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", innerWidth);
  svg.setAttribute("height", innerHeight);
  svg.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:visible";
  document.body.append(svg);
  const rc = rough.svg(svg);
  const pen = (seed, extra = {}) => ({ stroke: INK, strokeWidth: mobile ? 2 : 2.6, roughness: 1.4, bowing: 1.2, seed, ...extra });
  let seed = 3;

  const mark = (kind, r) => {
    const s = seed++;
    if (kind === "circle") {
      const pad = Math.max(10, r.height * 0.35);
      // two overlapping passes, like a quick pen loop
      svg.append(rc.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width + pad * 2, r.height + pad * 1.4, pen(s)));
      svg.append(rc.ellipse(r.x + r.width / 2 + 3, r.y + r.height / 2 - 2, r.width + pad * 2.2, r.height + pad * 1.2, pen(s + 50, { strokeWidth: 1.4 })));
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width + pad * 2, h: r.height + pad * 1.4 };
    }
    if (kind === "box") {
      svg.append(rc.rectangle(r.x - 14, r.y - 12, r.width + 28, r.height + 24, pen(s)));
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width + 28, h: r.height + 24 };
    }
    if (kind === "under") {
      const y = r.bottom + 2;
      svg.append(rc.line(r.x - 2, y, r.right + 4, y + 1, pen(s)));
      return { x: r.x + r.width / 2, y, w: r.width, h: 4 };
    }
    if (kind === "wave") {
      const y = r.bottom - r.height * 0.06, pts = [];
      for (let x = r.x; x <= r.right; x += 9) pts.push([x, y + ((x - r.x) / 9 % 2 ? 5 : -2)]);
      svg.append(rc.curve(pts, pen(s)));
      return { x: r.x + r.width / 2, y, w: r.width, h: 6 };
    }
  };

  const size = mobile ? 24 : 29;       // phone shot is shown small, so bigger handwriting
  const note = ({ at, rot, text }) => {
    const [x, y] = typeof at === "function" ? at() : at;
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x); t.setAttribute("y", y);
    t.setAttribute("fill", INK);
    t.setAttribute("style", `font: 600 ${size}px Caveat, cursive; letter-spacing: 0.01em`);
    text.split("\n").forEach((line, i) => {
      const span = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      span.setAttribute("x", x);
      span.setAttribute("dy", i ? size * 0.95 : 0);
      span.textContent = line;
      t.append(span);
    });
    svg.append(t);
    const b = t.getBBox();
    t.setAttribute("transform", `rotate(${rot} ${b.x + b.width / 2} ${b.y + b.height / 2})`);
    return b;
  };

  // Curved arrow from the note's nearest edge to the edge of the mark
  const arrow = (b, m, tip) => {
    if (tip) m = { x: tip[0], y: tip[1], w: 0, h: 0 };   // end exactly at a point
    const nx = b.x + b.width / 2, ny = b.y + b.height / 2;
    const dx = m.x - nx, dy = m.y - ny, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    // start just outside the note box, end just outside the mark's ellipse
    const tNote = Math.min(Math.abs((b.width / 2 + 8) / (ux || 1e-6)), Math.abs((b.height / 2 + 8) / (uy || 1e-6)));
    const tMark = tip ? 0 : 1 / Math.hypot(ux / (m.w / 2 + 8), uy / (m.h / 2 + 8));
    const sx = nx + ux * tNote, sy = ny + uy * tNote;
    const ex = m.x - ux * tMark, ey = m.y - uy * tMark;
    if (Math.hypot(ex - sx, ey - sy) < 12) return;
    const bend = 0.18 * Math.hypot(ex - sx, ey - sy);
    const cx = (sx + ex) / 2 - uy * bend, cy = (sy + ey) / 2 + ux * bend;
    svg.append(rc.curve([[sx, sy], [cx, cy], [ex, ey]], pen(seed++, { roughness: 0.9 })));
    const ang = Math.atan2(ey - cy, ex - cx), head = mobile ? 10 : 14;
    for (const a of [ang + 2.6, ang - 2.6]) {
      svg.append(rc.line(ex, ey, ex + Math.cos(a) * head, ey + Math.sin(a) * head, pen(seed++, { roughness: 0.6 })));
    }
  };

  for (const n of NOTES) {
    const done = n.marks.map(([kind, target]) => ({ target, m: mark(kind, rectOf(target)) }));
    const b = note(n);
    if (n.arrow === false || !done.length) continue;
    const pick = typeof n.arrow === "string" ? done.find((d) => Array.isArray(d.target) && d.target[1] === n.arrow) : done[0];
    arrow(b, pick.m, n.tip && n.tip());
  }
  svg.id = "pen";
  // phones: crop just below the last note (the buttons)
  window.__shotHeight = Math.ceil(R(".ctas").bottom + 76);
})();
