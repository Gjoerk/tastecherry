// Light / dark switch in the header. The theme itself is set before first
// paint by the inline script in index.html; this keeps the button in sync,
// remembers the choice and tells the 3D stages. The switch itself is one
// motion for the whole page: a circle of the new theme grows out of the
// button (View Transitions), so the 3D canvases can't change before or after
// the rest. Without View Transitions, or with reduced motion, it's instant.

export function themeToggle(button) {
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const label = button.querySelector(".theme-toggle__label");

  const sync = () => {
    const dark = root.dataset.theme === "dark";
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    label.textContent = dark ? "Light" : "Dark";          // what you switch to
    meta?.setAttribute("content", getComputedStyle(root).getPropertyValue("--paper").trim());
  };

  const apply = () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
    sync();
    dispatchEvent(new Event("themechange"));
  };

  button.addEventListener("click", () => {
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { apply(); return; }
    const r = button.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: "cubic-bezier(0.45, 0, 0.25, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  });
  sync();
}
