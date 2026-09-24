// Hero word swap: "Websites with Taste" → Sauce → Spice → Taste…
// The word, the footnote's first word and the 3D model fade out together and
// the next ones fade in. Only runs while the hero is on screen, never with
// reduced motion (then it simply stays on Taste).

const HOLD = 3700;   // ms each word stays fully visible (≈ 5.3 s per word with the fades)
const FADE = 800;    // ms out, then the same in (matches fruit.js and the CSS)

export function heroWords(hero, model) {
  const words = [...hero.querySelectorAll(".hero__word")];
  const note = hero.querySelector(".hero__note-word");
  const slot = hero.querySelector(".hero__words");
  if (words.length < 2) return;

  // Size the slot to one word (em, so it follows the fluid title size)
  const fit = (word) => {
    const em = parseFloat(getComputedStyle(slot).fontSize);
    slot.style.width = `${(word.getBoundingClientRect().width / em).toFixed(3)}em`;
  };

  let i = 0, timer = 0, visible = false;
  let models = null;

  // ?hero=sauce starts on that word (handy for reviewing one model)
  const wanted = new URLSearchParams(location.search).get("hero")?.toLowerCase();
  const start = words.findIndex((w) => w.textContent.toLowerCase() === wanted);
  if (start > 0) {
    words[0].classList.remove("is-active");
    words[start].classList.add("is-active");
    i = start;
  }
  // English / German: "Taste" becomes "Geschmack"; the footnote and the slot follow
  addEventListener("langchange", () => {
    note.textContent = words[i].dataset.note ?? words[i].textContent;
    fit(words[i]);
  });
  note.textContent = words[i].dataset.note ?? words[i].textContent;   // German: Geschmack
  document.fonts.ready.then(() => {           // first fit without the ease
    slot.style.transition = "none";
    fit(words[i]);
    slot.getBoundingClientRect();
    slot.style.transition = "";
  });
  model?.then((m) => { models = m; if (m && i) m.show(i); }).catch(() => {});
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const step = () => {
    const from = words[i];
    i = (i + 1) % words.length;
    const to = words[i];
    from.classList.remove("is-active");
    note.classList.add("is-out");
    models?.show(i);
    setTimeout(() => {
      fit(to);
      to.classList.add("is-active");
      note.textContent = to.dataset.note ?? to.textContent;
      note.classList.remove("is-out");
    }, FADE);
    schedule();
  };
  const schedule = () => { clearTimeout(timer); if (visible && !document.hidden) timer = setTimeout(step, HOLD + 2 * FADE); };

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); }, { threshold: 0.4 }).observe(hero);
  document.addEventListener("visibilitychange", schedule);
}
