// Screenshots ai.html with the red-pen markup from annotate.js for #problem.
//   npm i playwright && node render/compare/shoot.js
// Writes PNGs to render/out/compare/; `python3 render/finalize.py compare` turns them into WebP.
const { chromium } = require("playwright");
const path = require("path");

const OUT = path.join(__dirname, "../out/compare");
const SIZES = { desktop: [1280, 800], mobile: [390, 1200] };  // phone shot is cropped to the markup
const ROUGH = "https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js";
const FONT = "https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=block";

(async () => {
  require("fs").mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [size, [width, height]] of Object.entries(SIZES)) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    if (process.env.ROUTE) await require(process.env.ROUTE)(page);   // optional request routing (proxies)
    await page.goto("file://" + path.join(__dirname, "ai.html"), { waitUntil: "networkidle" });
    await page.addStyleTag({ url: FONT });
    await page.addScriptTag({ url: ROUGH });
    await page.evaluate(() => document.fonts.load('600 29px Caveat').then(() => document.fonts.ready));
    await page.addScriptTag({ path: path.join(__dirname, "annotate.js") });
    const clip = size === "mobile" ? { x: 0, y: 0, width, height: await page.evaluate(() => window.__shotHeight) } : undefined;
    await page.screenshot({ path: path.join(OUT, `ai-annotated-${size}.png`), clip });
    await page.close();
    console.log(`ai-annotated-${size}.png`);
  }
  await browser.close();
})();
