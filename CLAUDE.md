# tastecherry — Portfolio

One-page site for **tastecherry**, a web design business. Positioning: **AI-built websites, finished with taste.**
The site itself is the proof, so it must never look "vibe coded".

## Stack

Plain HTML/CSS/JS, no build step for the site. Preview: `python3 -m http.server 4321` (or the `site` config in `.claude/launch.json`).

3D: the hero models and the glasses run **real-time in Three.js** (CDN import map) and rotate by drag. The two
diamonds in `#approach` are **Cycles turntables** (pre-rendered frames, `turntable.js`), also draggable.
The hero title is plain black HTML text. A ceramic Blender render of it (`assets/img/hero/title*.webp`) is kept but unused.

The **Blender Cycles pipeline** in `render/` makes photoreal 360° turntables (120 WebP frames each by default, 3° apart;
fewer looks choppy). Rough and cut are rendered (on the desktop GPU) and live in `assets/img/turntable/`. To switch another object over, render it,
then change its markup from `data-scene="…"` to `data-turntable="assets/img/turntable/<name>" data-frames="120"`
(`data-frames` must match the number of frames on disk).

```
index.html                  all content, sections in page order
assets/css/tokens.css       colours, type scale, spacing, motion — the ONLY place raw values live
assets/css/base.css         reset + element defaults
assets/css/layout.css       container, 12-col grid, labels, buttons, links, media, reveal
assets/css/sections.css     one block per section, in page order (+ turntable styles)
assets/js/main.js           entry: boots data-scene (Three.js) / data-turntable (frames), header, reveal
assets/js/three/stage.js    renderer/scene/camera, on-screen-only loop, studio lighting, dragRotate()
assets/js/hero.js           hero word cycle (Taste/Sauce/Spice), drives the model swap
assets/js/three/fruit.js    hero scene: framing + fade between models;  cherry.js = wireframe cherries
assets/js/three/hero-models.js  ketchup squeeze bottle, chili;  wire.js = shared wireframe builder + setFade
assets/js/three/glasses.js  round glasses wireframe under the #cherry heading (transparent stage)
                            strawberry.js = unused alt (solid + wireframe)
assets/js/three/diamonds.js real-time rough + cut stones (unused since the renders);  gem.js = ray-traced gem shader
assets/js/turntable.js      viewer for pre-rendered frames (the diamonds)
assets/js/scroll-line.js    background line that draws itself from section title to section title while scrolling
assets/js/exhibit.js        Exhibit A in #problem: clean → red-pen sweep, toggle
assets/img/compare/         clean AI screenshot + red-pen layer for #problem (built from render/compare/)
assets/img/hero/            rendered ceramic title (title.webp 2400w, title-1200.webp)
assets/img/turntable/<name>/000–059.webp   rough, cut

render/                     Blender pipeline (not needed at runtime; exclude from deploys)
  build.sh                  render + convert: `render/build.sh [title cut strawberry rough]`
  common.py                 Cycles/Metal setup, colour management, studio lights, cards, turntable loop
  title.py                  voxel-fused, smoothed ceramic letters; exposure calibrated to --paper
  strawberry.py             procedural fruit: Poisson-disk seeds, dimples, calyx, baked boolean bite, flesh shader
  stones.py                 kind=rough (frosted skin + milky volume) | kind=cut (57-facet brilliant, dispersion)
  finalize.py               softens shadow-catcher shadows, writes WebP into assets/img (+ `compare` screenshots)
  compare/                  "Exhibit A" in #problem: ai.html, annotate.js (red-pen markup), shoot.js
  inspect_render.py         composites a render over --paper and reports the dominant face colour
  fonts/                    TTFs for the title (Blender can't read WOFF)
  out/                      raw PNG frames + build.log (scratch)
```
Requires Blender 5.2+. macOS: /Applications/Blender.app (`brew install --cask blender`). Windows: run `build.sh` from
Git Bash with `export BLENDER="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"`. The GPU backend is picked
automatically (OptiX → CUDA → HIP → oneAPI → Metal, else CPU); each run prints `[render] Cycles device: …`.
One-frame test: `FRAMES=0 blender -b --factory-startup -P render/stones.py -- kind=cut res=560 samples=96`.

## Current page (built step by step)

Nav: six-petal asterisk mark + "tastecherry" wordmark + handwritten "by gabriel" signed under the end of the wordmark (Caveat, accent) (SVG symbol `#asterisk`, same as favicon; no emoji) · Why me · Pricing · Contact (accent).

1. `#hero` — "Websites with *Taste*" + six-petal asterisk (links to the footnote), wireframe model rising behind the
   title (drag to rotate), footnote "*Taste is subjective. Mine just happens to be right." Nothing else in the hero.
   The word cycles Taste → Sauce → Spice (`hero.js`, ≈5.3 s each): word, footnote's first word and model fade out
   together (800 ms, eased in and out) and the next fade in; the word slot eases to each word's width so the line recentres smoothly.
   Models (all accent wireframes, framed on the cherries' box): cherries (`cherry.js`), diner squeeze bottle, leaning (ridged collar,
   cone nozzle, stopper on a tether), chili turned 20° clockwise (`hero-models.js`, built with `wire.js`). Pauses off screen; reduced motion stays on Taste. `?hero=sauce` etc.
   starts on a given word (for reviewing a model). Screen readers get "Taste" only.
   **Rule: everything in the hero must be visible on first load on every device.** The hero is exactly one screen tall
   (100svh minus header), content centred as one group; the title size is capped by viewport height; the model canvas
   takes the cherries' proportions (fruit.js sets --model-aspect), is capped to the height left after title and
   `--note-block` (footnote), and reaches up behind the title by --overlap so the top overlaps "with".
   Checked at 375×667, 1024×720, 1440×900.
2. `#problem` — 01 The problem: split (headline left, copy right) + "Exhibit A": a typical AI site (demo coffee roaster).
   Centred switch "AI slop / What’s wrong" (sliding block; "What’s wrong" in the Caveat hand, subset via `&text=`,
   plus a scribbled "(go on, click it)" on wide screens) → picture → caption. Switch, picture and caption always fit on
   one screen: the picture's width comes from the viewport height (`--ratio`, `--chrome`). It shows clean first, then a
   red pen sweeps over it (left-to-right clip, `--dur-draw`) 1.2 s after it is well in view; the switch or a click on
   the picture flips it (`exhibit.js`). Without JS the pen is just on. The pen is a transparent layer over the clean
   shot; desktop (1280×800) and phone (390 wide, cropped after the buttons) versions.
   Sources in `render/compare/`: `ai.html` (the only place the generic AI look is allowed) + `annotate.js` (rough.js
   marks + Caveat notes; the phone layout opens up gaps to write in). Rebuild: `node render/compare/shoot.js`
   (needs `npm i playwright`) then `python3 render/finalize.py compare` → `assets/img/compare/ai-{clean,pen}-*.webp`.
   If the phone image's size changes, update its width/height in index.html and `--ratio` in sections.css.
3. `#cherry` — 02 Cherry on top: split layout; the copy spans two rows so a wireframe of round glasses (`glasses.js`)
   fills the free space under the heading (hidden when stacked, ≤960px).
4. `#approach` — centred h2 "It’s Simple", then rough stone → arrow → cut brilliant ("AI's Finished Product" /
   "My Finished Product" as h3s). No other copy. Both stones are Cycles turntables (60 frames each, `turntable.js`).
5. `#why` — 03 Why me: four numbered items (accent 01–04, tabular figures, plain zero), 2×2 on desktop, stacked on phones, hairlines, no icons.
6. `#pricing` — 04 Pricing: three flat panels divided by hairlines (not shadowed cards) + "Just ask" link.
7. `#contact` — 05 Contact: split — pitch + mailto left, form right (Name, Email, Message; labels + required).
Background: a thin accent line (`scroll-line.js`) starts under the hero footnote and grows with scroll; when a section
lands at the top (scroll-padding, where the nav links go) its end touches that section's h2 (4px left of the first
letter). It drops down the left margin, snakes across only in the gaps between sections and comes down onto each
title from above-left of its label, so it never crosses copy (checked at 375, 1024, 1440). Behind everything
(`main` isolates, z-index -1); reduced motion shows it fully drawn.
Footer: Built with taste. · Impressum · Datenschutz · © 2026 tastecherry · Back to top.

Copy voice: short, plain, confident; jokes live in parenthetical asides, styled `.aside` (ink-soft): each sits on its own
line under the sentence it comments on and is never broken inside (inline only in the footer and captions).
Section system: `.section` (padding `--space-section`, hairline on top) → `.section-head` (numbered `.label` above an
`h2.section-head__title`, optional `__sub`). Text sections use `.container.split`: head in columns 1–6, `.split__body`
in 8–12, `.split__full` spans all; stacks below 960px. Other primitives: `.prose`/`.lead`, `.aside`,
`.button--accent`, `.field`.
Line breaks: no width caps on headlines; headings balance, paragraphs `pretty`; a sentence-level "I" is glued to the
next word with `&nbsp;` so it never ends a line. Keep that when editing copy.

## 3D notes

- Title flat faces must equal `--paper`: Standard view transform, exposure -2.33, calibrated with
  `inspect_render.py`. If lights/material change: render at a known exposure, measure, solve the offset in stops.
- Everything renders on transparent film with a shadow catcher; `finalize.py` softens those shadows.
- The M1 GPU times out on ray-marched (textured) volumes: keep the rough diamond's milk at constant density.
- Strawberry frame 0 shows the bite at the upper left. Leaves are trimmed (not booleaned) — thin shells break EXACT booleans.
- Turntables only animate on screen; `prefers-reduced-motion` disables idle spin (drag still works).

## Palette

- `--paper` #F3F1EB off-white background
- `--ink` #0F0F0E text
- `--accent` #CE0058 Rubine. Compare others with `?accent=cobalt|verdigris|oxide`.

## Type

- Familjen Grotesk (`--font-sans`) for everything: a grotesk with character (single-storey a), not the default everyone ships.
- Newsreader italic (`<em>`) only for emphasis inside headlines. Both from Google Fonts.
- Caveat (`--font-hand`) only for the red-pen bits of Exhibit A and the "by gabriel" signature, loaded as a subset of
  just those letters (extend the `&text=` in index.html if you add words).

## Design rules (anti-vibe-coded checklist)

Do:
- Use tokens for every colour, size, space and duration.
- Lay things out on the 12-column grid; use asymmetry and whitespace, not boxes.
- Separate content with hairline rules, not cards and shadows.
- Keep the accent rare: at most one or two accent moments per section.
- Use the serif italic (`<em>`) only for emphasis inside headlines.
- Keep motion subtle (fade and 16px rise) and respect `prefers-reduced-motion`.
- Write specific, plain copy.

Don't:
- Purple, indigo or blue-to-purple gradients; gradient text; glow; glassmorphism cards
- Emoji or generic icon-library icons as decoration
- Rounded-2xl cards with drop shadows in a three-up grid
- Everything centered
- Inter or Geist as the default font; Tailwind default colours
- Filler copy like "Unlock", "Elevate", "Seamless", "Supercharge"

## Placeholders to replace (TODO)

- Prices: One Page, Business, Care (`€ TODO` in `#pricing`).
- Contact form handler: the form posts to `#` (no backend yet).
- Impressum and Datenschutz links (`href="#"` in the footer).
- Confirm hello@tastecherry.com is a live mailbox.
