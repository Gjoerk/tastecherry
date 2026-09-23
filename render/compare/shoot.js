// Screenshots ai.html for #problem, light and dark: the clean page, and the
// red-pen markup from annotate.js alone on a transparent background (laid over
// the clean shot on the site; the layout is identical in both themes, so one
// pen layer serves both — the dark pen shot is only there to check that).
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
  for (const theme of ["light", "dark"]) for (const [size, [width, height]] of Object.entries(SIZES)) {
    const tag = theme === "dark" ? `${size}-dark` : size;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    if (process.env.ROUTE) await require(process.env.ROUTE)(page);   // optional request routing (proxies)
    await page.goto("file://" + path.join(__dirname, "ai.html"), { waitUntil: "networkidle" });
    if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.addStyleTag({ url: FONT });
    await page.addScriptTag({ url: ROUGH });
    await page.evaluate(() => document.fonts.load('600 29px Caveat').then(() => document.fonts.ready));
    await page.addScriptTag({ path: path.join(__dirname, "annotate.js") });
    const clip = size === "mobile" ? { x: 0, y: 0, width, height: await page.evaluate(() => window.__shotHeight) } : undefined;
    await page.addStyleTag({ content: "#pen { visibility: hidden }" });
    await page.screenshot({ path: path.join(OUT, `ai-clean-${tag}.png`), clip });
    await page.addStyleTag({ content: `
      html, body, nav, header { background: transparent !important; box-shadow: none !important; }
      body * { visibility: hidden !important; }
      #pen, #pen * { visibility: visible !important; }` });
    await page.screenshot({ path: path.join(OUT, `ai-pen-${tag}.png`), clip, omitBackground: true });
    await page.close();
    console.log(`ai-clean-${tag}.png ai-pen-${tag}.png`);
  }
  await browser.close();
})();
