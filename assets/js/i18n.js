// English / German. The page is written in English; every translatable piece
// carries a key (data-i18n="key" swaps its HTML, data-i18n-attr="alt:key,…"
// swaps attributes) and German comes from DE below. The English originals are
// read from the page once, so switching back needs no second copy.
// The choice is remembered; the first visit follows the browser language (set
// before first paint by the inline script in index.html, which hides the page
// until German is in). Buzzwords stay English (Sauce, Spice, One Page, Care …).
//
// German copy: du-form, same voice as the English (short, plain, jokes in the asides).

const DE = {
  "doc.title": "tastecherry — Websites mit Geschmack",
  "doc.description": "KI baut sie. Ich mache sie gut. Websites mit Geschmack, zu Festpreisen.",
  "skip": "Zum Inhalt springen",
  "wordmark": "tastecherry by gabriel, Startseite",
  "nav": "Hauptnavigation",
  "lang": "Sprache",
  "nav.why": "Warum ich",
  "nav.pricing": "Preise",
  "nav.contact": "Kontakt",
  "theme.dark": "Dunkel",
  "theme.light": "Hell",
  "theme.toDark": "Zum dunklen Modus wechseln",
  "theme.toLight": "Zum hellen Modus wechseln",

  "hero.with": "Websites<br>mit",
  "hero.taste": "Geschmack",
  "hero.seenote": "(siehe Fußnote)",
  "hero.model": "Eine Strichzeichnung zweier Kirschen am Stiel, ab und zu abgelöst von einer Ketchup-Quetschflasche oder einer Chili.",
  "hero.note": " ist subjektiv.<br class=\"hero__note-break\"> Ich&nbsp;mach’s halt richtig.",

  "problem.label": "<span class=\"index\">01</span> Das Problem",
  "problem.title": "KI baut dir in 30&nbsp;Sekunden eine Website.",
  "problem.lead": "Und sie sieht okay aus. <span class=\"aside\">(Genau wie die anderen 10.000.)</span>",
  "problem.body": "Gleiche Schriften. Gleiche Verläufe. Gleiches „Entfalte dein Potenzial“. Alles sieht gut aus, und alles sieht gleich aus. Kein Charakter, keine Liebe.",
  "exhibit.group": "Beweisstück A zeigen als",
  "exhibit.clean": "KI-Slop",
  "exhibit.pen": "Was passt nicht?",
  "exhibit.nudge": "(na los, klick&nbsp;drauf)",
  "exhibit.alt.clean": "Die Website einer Kaffeerösterei, direkt aus der KI: Logo mit Lila-Blau-Verlauf, zentrierte Headline „Unlock the Perfect Cup of Coffee“, Verlaufs-Buttons, drei abgerundete Karten mit Emoji-Icons.",
  "exhibit.alt.dark": "Dieselbe KI-Seite im dunklen Design: fast schwarzes Marineblau, leuchtende Lila-Blau-Verläufe, dunkle abgerundete Karten mit Emoji-Icons.",
  "exhibit.alt.pen": "Rote Korrekturen darauf: „emoji + gradient logo. bold choice.“, „shitty button #1“, „sparkles = AI was here“, „gradient text. in Inter. again.“, „buzzword bingo! 3/3“, „shitty buttons (rocket included, free)“, „3 rounded cards, drop shadows, emoji in a box. every. time.“",
  "exhibit.caption": "<span class=\"label\">Beweisstück A</span> Ein typischer KI-Erstentwurf.",

  "cherry.label": "<span class=\"index\">02</span> Die Kirsche auf der Torte",
  "cherry.title": "Da komme ich&nbsp;ins Spiel.",
  "cherry.model": "Eine runde Schichttorte, ein Stück herausgeschnitten, mit einer Kirsche obendrauf.",
  "cherry.lead": "Die KI macht die Schwerarbeit.<br> Ich&nbsp;mache den Teil, den sie nicht kann: Charakter.",
  "cherry.p1": "Ich&nbsp;steuere die KI, überarbeite das Design und treffe die Entscheidungen, die deiner Seite Persönlichkeit geben. Ich&nbsp;weiß, was deine Kunden sehen wollen, und wann sie den Tab schließen.",
  "cherry.p2": "Jedes Detail zählt. Schriften, Abstände, Farben, dieser eine Button, der zwei Pixel daneben liegt. Nichts geht unbearbeitet raus. <span class=\"aside\">(Mich&nbsp;stört das mehr als dich.)</span>",

  "refine.title": "Ganz einfach",
  "refine.rough": "Ein roher, milchiger, ungeschliffener Diamant.",
  "refine.cut": "Ein polierter Diamant im Brillantschliff.",
  "refine.ai": "Die <span class=\"scare\">„</span>fertige<span class=\"scare\">“</span> Website der KI",
  "refine.mine": "Meine fertige Website",

  "why.label": "<span class=\"index\">03</span> Warum ich",
  "why.title": "Warum ich und keine Agentur?",
  "why.1.title": "Deutlich günstiger.",
  "why.1.body": "Agenturqualität ohne Agenturrechnung. <span class=\"aside\">(Kein&nbsp;Bürohund, der gefüttert werden&nbsp;will.)</span>",
  "why.2.title": "Wirklich fertig.",
  "why.2.body": "Du bekommst eine funktionierende Website, keine Figma-Datei und ein „Phase&nbsp;2“-Meeting.",
  "why.3.title": "Sei komplett ehrlich.",
  "why.3.body": "Dir gefällt etwas nicht? Sag es. Ich&nbsp;ändere es.",
  "why.4.title": "Sieht hochwertig aus. Sieht nach dir aus.",
  "why.4.body": "Kein Template, auf das nur dein Logo geklatscht wurde.",

  "pricing.label": "<span class=\"index\">04</span> Preise",
  "pricing.title": "Preise",
  "pricing.sub": "Festpreise. <span class=\"aside\">(Keine Stundensätze, keine Überraschungsrechnungen.)</span>",
  "pricing.from": "ab",
  "pricing.month": "/ Monat",
  "pricing.one.amount": "490&nbsp;€",
  "pricing.business.amount": "1.190&nbsp;€",
  "pricing.care.amount": "29&nbsp;€",
  "pricing.f.onepage": "Eine Seite",
  "pricing.f.mobile": "Für Smartphones optimiert",
  "pricing.f.form": "Kontaktformular",
  "pricing.f.domain": "Domain-Einrichtung",
  "pricing.f.feedback": "3 Feedbackrunden",
  "pricing.f.pages": "Bis zu 5 Seiten",
  "pricing.f.cms": "Inhalte, die du selbst bearbeiten&nbsp;kannst",
  "pricing.f.seo": "Basis-SEO",
  "pricing.f.hosting": "Hosting",
  "pricing.f.updates": "Updates",
  "pricing.f.backups": "Backups",
  "pricing.f.changes": "Bis zu 30&nbsp;Min. Änderungen pro&nbsp;Monat",
  "pricing.one.for": "<span class=\"label\">Für</span> Schnell online gehen <span class=\"aside\">(und dabei gut&nbsp;aussehen)</span>",
  "pricing.business.for": "<span class=\"label\">Für</span> Wenn eine Seite nicht reicht",
  "pricing.care.for": "<span class=\"label\">Für</span> Damit du nie wieder daran denken&nbsp;musst",
  "pricing.note": "Nicht sicher, welches? <a class=\"link-cta\" href=\"#contact\">Frag einfach.</a>",

  "contact.label": "<span class=\"index\">05</span> Kontakt",
  "contact.title": "Lass uns Websites mit <em>Bedeutung</em> bauen.",
  "contact.intro": "Erzähl mir, was du machst und was du brauchst. Ich&nbsp;antworte innerhalb von 24&nbsp;Stunden. <span class=\"aside\">(Meistens schneller.)</span>",
  "contact.alt": "Oder schreib einfach: <a class=\"link-cta\" href=\"mailto:hello@tastecherry.com\">hello@tastecherry.com</a>",
  "contact.name": "Name",
  "contact.email": "E-Mail",
  "contact.message": "Nachricht",
  "contact.send": "Senden",

  "eye.model": "Ein realistischer Augapfel, der deinem Mauszeiger folgt.",
  "eye.sub": "Ich&nbsp;stecke in deine Website so viel Sorgfalt wie in diese hier.",

  "footer.built": "Mit Geschmack gebaut.",
  "footer.top": "Nach oben",
};

// UI strings that scripts write (theme switch); English here, German in DE
const EN_UI = {
  "theme.dark": "Dark",
  "theme.light": "Light",
  "theme.toDark": "Switch to dark mode",
  "theme.toLight": "Switch to light mode",
};

const root = document.documentElement;
const originals = new Map();          // element → { html, attrs: { name: value } }
let lang = root.lang === "de" ? "de" : "en";

export const currentLang = () => lang;
export const t = (key) => (lang === "de" && DE[key]) || EN_UI[key] || key;

function remember() {
  for (const el of document.querySelectorAll("[data-i18n], [data-i18n-attr]")) {
    const attrs = {};
    for (const pair of (el.dataset.i18nAttr ?? "").split(",").filter(Boolean)) {
      const name = pair.split(":")[0].trim();
      attrs[name] = el.getAttribute(name);
    }
    originals.set(el, { html: el.dataset.i18n ? el.innerHTML : null, attrs });
  }
  originals.set(document, {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
  });
}

function apply() {
  const de = lang === "de";
  for (const [el, orig] of originals) {
    if (el === document) continue;
    if (el.dataset.i18n) el.innerHTML = de && DE[el.dataset.i18n] != null ? DE[el.dataset.i18n] : orig.html;
    for (const pair of (el.dataset.i18nAttr ?? "").split(",").filter(Boolean)) {
      const [name, key] = pair.split(":").map((x) => x.trim());
      el.setAttribute(name, de && DE[key] != null ? DE[key] : orig.attrs[name]);
    }
  }
  const doc = originals.get(document);
  document.title = de ? DE["doc.title"] : doc.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", de ? DE["doc.description"] : doc.description);
  root.lang = lang;
  for (const b of document.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
}

export function setLang(next) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem("lang", lang); } catch {}
  apply();
  dispatchEvent(new Event("langchange"));
}

// The switch as one motion, like the light / dark one: a circle grows out of
// the button until it covers the page, greeting you in the new language
// ("Hallo." / "Hello."); behind it the text is swapped (and everything that
// measures text re-lays out, unseen); then the cover fades away.
// Reduced motion: instant.
const GREETING = { de: ["Hallo.", "Deutsch"], en: ["Hello.", "English"] };
let switching = false;

async function switchLang(next, button) {
  if (next === lang || switching) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !Element.prototype.animate) { setLang(next); return; }
  switching = true;
  const r = button.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const [word, name] = GREETING[next];
  const cover = document.createElement("div");
  cover.className = "lang-wipe";
  cover.setAttribute("aria-hidden", "true");
  cover.innerHTML = `<p class="lang-wipe__word" lang="${next}">${word}</p><p class="lang-wipe__name">${name}</p>`;
  document.body.append(cover);
  const ease = "cubic-bezier(0.45, 0, 0.25, 1)";           // --ease-in-out
  await cover.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: 650, easing: ease, fill: "forwards" }).finished;
  setLang(next);                                             // swapped under the cover
  await new Promise((done) => setTimeout(done, 450));        // let the greeting land
  await cover.animate({ opacity: [1, 0] }, { duration: 450, easing: ease, fill: "forwards" }).finished;
  cover.remove();
  switching = false;
}

// Called first thing from main.js: German (if chosen) is in before anything measures text
export function initLang() {
  remember();
  apply();
  root.classList.remove("i18n-pending");
  for (const b of document.querySelectorAll("[data-lang]")) b.addEventListener("click", () => switchLang(b.dataset.lang, b));
}
