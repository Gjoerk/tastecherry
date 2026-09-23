// Entry point. 3D is progressive enhancement: the page reads fine without
// WebGL or JavaScript.
//
// Two ways to show a rotatable object:
//   data-scene="fruit|cupcake"             real-time Three.js model
//   data-turntable="assets/img/…"        pre-rendered Blender frames (the diamonds)

import { turntable } from "./turntable.js";
import { exhibit } from "./exhibit.js";
import { heroWords } from "./hero.js";
import { scrollLine } from "./scroll-line.js";

document.querySelectorAll("[data-turntable]").forEach(turntable);
document.querySelectorAll("[data-exhibit]").forEach(exhibit);

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
  if (scene("cupcake") && getComputedStyle(scene("cupcake")).display !== "none") {
    import("./three/cupcake.js")
      .then(({ initCupcake }) => initCupcake(scene("cupcake")))
      .catch((err) => console.error("Cupcake scene failed", err));
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

// Background line that draws itself from title to title as you scroll
scrollLine(document.querySelector("main"), {
  start: document.querySelector(".hero__note"),
  titles: [...document.querySelectorAll("main > .section h2")],
});

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
