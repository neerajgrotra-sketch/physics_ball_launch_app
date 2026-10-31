// Draws the link-preview picture (public/og.png, 1200 × 630) that chat apps show under a shared link (the og:image in
// public/index.html): graph paper, a cannon shot banking off two bars into the glass, the title and "Can you beat my shot?".
// Renders an HTML page with Playwright, so it uses the game's own fonts and colours. Run: node scripts/make-og.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright isn't a project dependency: use any installed copy (run with NODE_PATH=$(npm root -g) if it's installed globally).
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const icon = readFileSync(join(ROOT, 'public/icons/icon-512.png')).toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600&family=Barlow+Condensed:wght@700&display=block" rel="stylesheet">
<style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; font-family: Barlow, sans-serif; }
  .card { position: relative; width: 1200px; height: 630px; background-color: #e9eee3;
    background-image: linear-gradient(#cfdacb 1.5px, transparent 1.5px), linear-gradient(90deg, #cfdacb 1.5px, transparent 1.5px);
    background-size: 40px 40px; }
  svg { position: absolute; right: 30px; top: 25px; }
  .text { position: absolute; left: 70px; top: 120px; width: 560px; }
  .row { display: flex; align-items: center; gap: 22px; }
  img { width: 112px; height: 112px; border-radius: 26px; box-shadow: 0 6px 20px rgba(0,0,0,.18); }
  h1 { margin: 0; font: 700 112px/1 'Barlow Condensed'; color: #2c3133; }
  h2 { margin: 34px 0 0; font: 700 64px/1.05 'Barlow Condensed'; color: #b5352a; }
  p { margin: 22px 0 0; font: 600 32px/1.3 Barlow; color: #2d5c9e; }
</style></head><body><div class="card">
  <svg width="560" height="580" viewBox="0 0 560 580">
    <line x1="0" y1="540" x2="560" y2="540" stroke="#2c3133" stroke-width="8"/>
    <polyline points="70,500 170,250 330,140 470,330 430,470 430,520" fill="none" stroke="#b5352a" stroke-width="7" stroke-linejoin="round" stroke-dasharray="2 16" stroke-linecap="round"/>
    <line x1="120" y1="230" x2="230" y2="265" stroke="#2d5c9e" stroke-width="18" stroke-linecap="round"/>
    <line x1="290" y1="110" x2="380" y2="165" stroke="#2d5c9e" stroke-width="18" stroke-linecap="round"/>
    <line x1="440" y1="290" x2="505" y2="370" stroke="#2d5c9e" stroke-width="18" stroke-linecap="round"/>
    <rect x="395" y="440" width="70" height="98" fill="#b5352a" opacity=".12"/>
    <line x1="395" y1="440" x2="395" y2="538" stroke="#b5352a" stroke-width="8"/>
    <line x1="465" y1="440" x2="465" y2="538" stroke="#b5352a" stroke-width="8"/>
    <line x1="380" y1="538" x2="480" y2="538" stroke="#b5352a" stroke-width="8"/>
    <polygon points="45,536 95,536 78,505 62,505" fill="#a7aeb3"/>
    <line x1="70" y1="505" x2="92" y2="470" stroke="#2c3133" stroke-width="13" stroke-linecap="round"/>
    <circle cx="430" cy="518" r="15" fill="#a7aeb3" stroke="#2c3133" stroke-width="4"/>
  </svg>
  <div class="text">
    <div class="row"><img src="data:image/png;base64,${icon}"><h1>Bank Shot</h1></div>
    <h2>Can you beat my shot?</h2>
    <p>A bounce puzzle you play right in your browser. Free, no download.</p>
  </div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
writeFileSync(join(ROOT, 'public/og.png'), await page.screenshot({ type: 'png' }));
await browser.close();
console.log('wrote public/og.png');
