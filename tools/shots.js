// Dev tool: plays the game in headless Chromium and saves a screenshot of
// each major screen to shots/ (the README uses some of them).
//   node tools/shots.js        (needs playwright)
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'shots');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 820, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(root, 'index.html'));

  const game = fn => page.evaluate(fn);
  const state = () => game(() => window.__C94.state);
  const waitFor = async (pred, what, ms = 20000) => {
    const t0 = Date.now();
    while (!(await game(pred))) {
      if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what} (state: ${await state()})`);
      await page.waitForTimeout(15);
    }
  };
  const waitState = (s, ms) => waitFor(new Function(`return window.__C94.state === '${s}'`), s, ms);
  const shot = name => page.locator('#game').screenshot({ path: path.join(outDir, name + '.png') });
  const key = k => page.keyboard.press(k);

  await page.waitForTimeout(700);
  await shot('1-title');
  await key('Enter'); await waitState('menu'); await page.waitForTimeout(200);
  await shot('2-menu');
  await key('Enter'); await waitState('icereport'); await page.waitForTimeout(600);
  await shot('3-ice-report');
  await key('Space'); await waitState('prethrow'); await page.waitForTimeout(400);
  await key('Space'); await waitState('curl'); await page.waitForTimeout(200);
  await shot('4-handle');
  await key('Space'); await waitState('aim'); await page.waitForTimeout(500);
  await shot('5-aim');
  await waitFor(() => Math.abs(window.__C94.aimAng) < 0.006, 'the arrow to cross the centre line');
  await key('Space'); await waitState('power');
  await waitFor(() => window.__C94.power >= 0.62, 'a firm draw on the bar');
  await shot('6-weight');
  await key('Space'); await waitState('slide');
  await waitFor(() => window.__C94.watch.split !== null, 'the near hog line');
  for (let i = 0; i < 12; i++) { await key('Space'); await page.waitForTimeout(70); }
  await shot('7-sweep');
  await waitState('postthrow', 60000); await page.waitForTimeout(900);
  await shot('8-house');

  // let the CPU throw, so the stopwatch shows the previous stone's time
  await waitFor(() => window.__C94.cpuTurn && window.__C94.state === 'slide' && window.__C94.watch.split !== null, 'the CPU stone', 60000);
  await page.waitForTimeout(500);
  await shot('8b-cpu-stone');

  // play out the end with quick throws to reach the scoreboard
  for (let guard = 0; guard < 6000; guard++) {
    const s = await state();
    if (s === 'endscore' || s === 'gameover') break;
    if (!(await game(() => window.__C94.cpuTurn)) && s !== 'deliver' && s !== 'postthrow') await key('Space');
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(400);
  await shot('9-endscore');

  await browser.close();
  if (errors.length) { console.error('page errors:', errors); process.exit(1); }
  console.log('saved:', fs.readdirSync(outDir).filter(f => /^\d/.test(f)).join(', '));
})().catch(e => { console.error(e); process.exit(1); });
