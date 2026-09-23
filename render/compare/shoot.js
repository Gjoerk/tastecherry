// Screenshots the two demo pages for the before/after slider in #problem.
//   npm i playwright && node render/compare/shoot.js
// Writes PNGs to render/out/compare/; `python3 render/finalize.py compare` turns them into WebP.
const { chromium } = require("playwright");
const path = require("path");

const OUT = path.join(__dirname, "../out/compare");
const SIZES = { desktop: [1280, 800], mobile: [390, 780] };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const name of ["ai", "polished"]) {
    for (const [size, [width, height]] of Object.entries(SIZES)) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      await page.goto("file://" + path.join(__dirname, `${name}.html`), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(OUT, `${name}-${size}.png`) });
      await page.close();
      console.log(`${name}-${size}.png`);
    }
  }
  await browser.close();
})();
