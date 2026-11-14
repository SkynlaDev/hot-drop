// Captures d'écran de vérification : node tools/shot.mjs <sortie.png> <script.js> [port]
// Le script (exécuté dans la page, vite en dev) prépare une scène : modules importés par `await import('/src/...')`.
// Il reçoit `game` (Phaser.Game) et peut renvoyer un délai d'attente en ms avant la capture.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [out, scriptPath, port = '5180'] = process.argv.slice(2);
const body = scriptPath ? readFileSync(scriptPath, 'utf8') : 'return 500;';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('ERREUR PAGE', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.game?.scene?.isActive('menu'), null, { timeout: 30000 });
const wait = await page.evaluate(`(async () => { const game = window.game; ${body} })()`);
await page.waitForTimeout(typeof wait === 'number' ? wait : 800);
// CLICKS="x,y,attente_ms;…" en coordonnées du jeu (720 × 1280) : touches successives, capture à la fin.
for (const c of (process.env.CLICKS ?? '').split(';').filter(Boolean)) {
  const [x, y, ms] = c.split(',').map(Number);
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + (x / 720) * box.width, box.y + (y / 1280) * box.height);
  await page.waitForTimeout(ms || 500);
}
await page.screenshot({ path: out });
await browser.close();
