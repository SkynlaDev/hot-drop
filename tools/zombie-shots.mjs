// node shot.mjs <outdir> <step...>
// Étapes : menu, hub, class, arsenal, game[:secondes], levelup, end
import { chromium } from 'playwright';
const out = process.argv[2];
const steps = process.argv.slice(3);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const start = (key, data) => page.evaluate(([k, d]) => {
  const g = window.game;
  const running = g.scene.getScenes(true);
  const host = running[0];
  for (const s of running) if (s !== host) s.scene.stop();
  host.scene.start(k, d);
}, [key, data]);
const snap = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
for (const st of steps) {
  const [kind, arg] = st.split(':');
  if (kind === 'eval') { console.log(await page.evaluate(arg)); continue; }
  if (kind === 'menu') { await start('menu'); await page.waitForTimeout(1600); await snap('menu'); }
  if (kind === 'hub') { await start('zhub'); await page.waitForTimeout(1200); await snap('hub'); }
  if (kind === 'class') { await start('zclass', { slot: 1 }); await page.waitForTimeout(1200); await snap('class'); }
  if (kind === 'arsenal') { await start('zarsenal', { weapon: arg || 'fusil_assaut' }); await page.waitForTimeout(1200); await snap('arsenal' + (arg ? '-' + arg : '')); }
  if (kind === 'end') { await page.waitForTimeout(3500); await snap('end'); }
  if (kind === 'game') {
    await start('zgame', { slot: 0 });
    await page.waitForTimeout(1500);
    const secs = Number(arg || 20);
    // Accélère : fait avancer la simulation en sautant le temps (setTimeScale), et bouge en cercle au doigt.
    await page.mouse.move(360, 900);
    await page.mouse.down();
    const t0 = Date.now();
    let a = 0;
    while (Date.now() - t0 < secs * 1000) {
      a += 0.15;
      await page.mouse.move(360 + Math.cos(a) * 70, 900 + Math.sin(a) * 70, { steps: 2 });
      await page.waitForTimeout(80);
      // Choisit le premier power-up quand la fenêtre de niveau s'ouvre.
      const lv = await page.evaluate(() => { const h = window.game.scene.getScene('zhud'); return h && h.blocking && h.blocking(); });
      if (lv) {
        await page.mouse.up();
        if (!globalThis.__lvshot) { globalThis.__lvshot = 1; await page.waitForTimeout(700); await snap('levelup'); }
        await page.mouse.click(360, 410);
        await page.waitForTimeout(300);
        await page.mouse.move(360, 900);
        await page.mouse.down();
      }
    }
    await page.mouse.up();
    await snap('game-' + secs);
  }
  if (kind === 'skip') {
    // Avance la partie de N secondes de simulation d'un coup (bot simple), pour voir la fin de partie.
    await page.evaluate((n) => {
      const g = window.game.scene.getScene('zgame');
      const w = g.world;
      for (let i = 0; i < n * 30; i++) {
        w.mx = Math.cos(i / 90); w.my = Math.sin(i / 90);
        w.update(1 / 30);
        while (w.pendingLevels > 0) w.choose(w.drawChoices()[0]);
        if (w.dead) break;
      }
    }, Number(arg));
    await page.waitForTimeout(600);
    await snap('skip-' + arg);
  }
  if (kind === 'kill') {
    await page.evaluate(() => { const w = window.game.scene.getScene('zgame').world; w.hp = 1; w.invuln = 0; w.stats.regen = 0; });
    await page.waitForTimeout(4000);
  }
  if (kind === 'wait') await page.waitForTimeout(Number(arg));
  if (kind === 'click') { const [x, y] = arg.split(',').map(Number); await page.mouse.click(x, y); await page.waitForTimeout(400); }
  if (kind === 'key') { await page.keyboard.press(arg); await page.waitForTimeout(400); }
  if (kind === 'snap') await snap(arg);
}
console.log(errors.slice(0, 20).join('\n'));
await browser.close();
