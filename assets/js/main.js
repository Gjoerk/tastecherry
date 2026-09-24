// Entry point. 3D is progressive enhancement: the page reads fine without
// WebGL or JavaScript.
//
// Two ways to show a rotatable object:
//   data-scene="fruit|cake|eye"            real-time Three.js model
//   data-turntable="assets/img/…"        pre-rendered Blender frames (the diamonds)
//   data-gaze="assets/img/eye"           pre-rendered gaze grid (Cycles eye; parked, not in the page)

import { initLang } from "./i18n.js";
import { turntable } from "./turntable.js";
import { exhibit } from "./exhibit.js";
import { heroWords } from "./hero.js";
import { sectionMark } from "./section-mark.js";
import { themeToggle } from "./theme.js";

// English / German first, so everything below measures the right text
initLang();

document.querySelectorAll("[data-turntable]").forEach(turntable);
document.querySelectorAll("[data-exhibit]").forEach(exhibit);
const gazes = document.querySelectorAll("[data-gaze]");      // the Cycles eye, if it's ever swapped in
if (gazes.length) import("./gaze.js").then(({ gaze }) => gazes.forEach((el) => gaze(el).catch((err) => console.warn("gaze:", err.message))));

const webgl = (() => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
})();

let heroModels = null;   // resolves to { show(i) } once the hero 3D is up
if (webgl) {
  const scene = (name) => document.querySelector(`[data-scene=${name}]`);

  if (scene("fruit")) {
    heroModels = import("./three/fruit.js")
      .then(({ initFruit }) => initFruit(scene("fruit")))
      .catch((err) => { console.error("Fruit scene failed", err); return null; });
  }
  if (scene("cake") && getComputedStyle(scene("cake")).display !== "none") {
    import("./three/cake.js")
      .then(({ initCake }) => initCake(scene("cake")))
      .catch((err) => console.error("Cake scene failed", err));
  }
  if (scene("eye")) {
    import("./three/eye.js")
      .then(({ initEye }) => initEye(scene("eye")))
      .catch((err) => console.error("Eye scene failed", err));
  }
  if (scene("rough") && scene("cut")) {
    import("./three/diamonds.js")
      .then(({ initDiamonds }) => initDiamonds({ rough: scene("rough"), cut: scene("cut") }))
      .catch((err) => console.error("Diamond scenes failed", err));
  }
}

// Hero: Taste → Sauce → Spice (word, footnote and model together)
const hero = document.querySelector(".hero");
if (hero) heroWords(hero, heroModels);

// Asterisk that marks the current section, next to its label; lives in the hero footnote's asterisk
sectionMark(document.querySelector("main"), [...document.querySelectorAll("main > .section")],
  document.querySelector(".hero__note-mark"));

// "It's Simple": the brush stroke comes in while the title is well on screen, goes when it leaves
const simple = document.querySelector(".refine__title");
if (simple) new IntersectionObserver(([e]) => simple.classList.toggle("is-brushed", e.isIntersecting),
  { rootMargin: "-8% 0px -45% 0px" }).observe(simple);   // only while in the upper part of the screen

// The arrow between the stones draws itself in while they're on screen
const arrow = document.querySelector(".refine__arrow");
if (arrow) new IntersectionObserver(([e]) => arrow.classList.toggle("is-drawn", e.isIntersecting),
  { rootMargin: "-15% 0px -25% 0px" }).observe(arrow);

// Cherry on top: centre the cake under the heading's text (narrower than its column)
const cake = document.querySelector(".cherry__model");
const cakeTitle = document.querySelector("#cherry h2");
if (cake && cakeTitle) {
  const centre = () => {
    const range = document.createRange();
    range.selectNodeContents(cakeTitle);
    const widest = Math.max(...[...range.getClientRects()].map((r) => r.width));
    cake.style.marginLeft = `${Math.max(0, (widest - cake.offsetWidth) / 2)}px`;
  };
  new ResizeObserver(centre).observe(cakeTitle);
  document.fonts?.ready.then(centre);
}

// Light / dark switch
const toggle = document.querySelector("[data-theme-toggle]");
if (toggle) themeToggle(toggle);

// Header hairline once the page is scrolled
const header = document.querySelector("[data-header]");
const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// Reveal-on-scroll
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("is-visible");
    io.unobserve(entry.target);
  }
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
