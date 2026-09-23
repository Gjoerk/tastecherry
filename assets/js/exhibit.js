// Exhibit A in #problem: the AI site starts clean ("looks fine, right?"),
// then the red pen sweeps over it once it's properly on screen. The toggle
// buttons, or a click on the picture, flip between the two.

export function exhibit(root) {
  const buttons = [...root.querySelectorAll("[data-show]")];
  const frame = root.querySelector(".exhibit__frame");
  let touched = false;

  const show = (marked) => {
    root.classList.toggle("is-marked", marked);
    for (const b of buttons) b.setAttribute("aria-pressed", String((b.dataset.show === "pen") === marked));
  };
  show(false);
  const touch = () => { touched = true; root.classList.add("was-toggled"); };

  for (const b of buttons) {
    b.addEventListener("click", () => { touch(); show(b.dataset.show === "pen"); });
  }
  frame.addEventListener("click", () => { touch(); show(!root.classList.contains("is-marked")); });

  // Give people a second to look at the clean version first
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    setTimeout(() => { if (!touched) show(true); }, 1200);
  }, { threshold: 0.6 });
  io.observe(frame);
}
