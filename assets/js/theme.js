// Light / dark switch in the header. The theme itself is set before first
// paint by the inline script in index.html; this keeps the button in sync,
// remembers the choice, and tells the 3D stages to repaint their background.

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

  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
    sync();
    dispatchEvent(new Event("themechange"));
  });
  sync();
}
