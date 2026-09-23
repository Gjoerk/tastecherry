// Entry point. 3D is progressive enhancement: the page reads fine without
// WebGL or JavaScript.
//
// Two ways to show a rotatable object:
//   data-scene="fruit|rough|cut"         real-time Three.js model (current)
//   data-turntable="assets/img/…"        pre-rendered Blender frames (render/ pipeline)

import { turntable } from "./turntable.js";

document.querySelectorAll("[data-turntable]").forEach(turntable);

const webgl = (() => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
})();

if (webgl) {
  const scene = (name) => document.querySelector(`[data-scene=${name}]`);

  if (scene("fruit")) {
    import("./three/fruit.js")
      .then(({ initFruit }) => initFruit(scene("fruit")))
      .catch((err) => console.error("Fruit scene failed", err));
  }
  if (scene("rough") && scene("cut")) {
    import("./three/diamonds.js")
      .then(({ initDiamonds }) => initDiamonds({ rough: scene("rough"), cut: scene("cut") }))
      .catch((err) => console.error("Diamond scenes failed", err));
  }
}

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
