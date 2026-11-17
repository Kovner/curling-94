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

  // put a guard and a house stone out there so the aiming screens show them
  await game(() => {
    const at = (team, y, z) => ({ team, y, z, vy: 0, vz: 0, spin: 1, rot: 0, alive: true, touched: false });
    window.__C94.stones.push(at(1, 34.1, -0.35), at(1, 38.0, 0.45));
  });
  await key('Space'); await waitState('curl'); await page.waitForTimeout(200);
  await shot('4-handle');
  await key('Space'); await waitState('aim'); await page.waitForTimeout(500);
  await shot('5-aim');

  // the throw is one motion: press to lock the line, hold while the bar climbs, let go
  await waitFor(() => Math.abs(window.__C94.aimAng) < 0.006, 'the arrow to cross the centre line');
  await page.keyboard.down('Space'); await waitState('power');
  await waitFor(() => window.__C94.power >= 0.4, 'weight on the bar');
  await shot('6-weight');
  await page.keyboard.up('Space'); await waitState('slide');
  await waitFor(() => window.__C94.watch.split !== null, 'the near hog line');
  for (let i = 0; i < 12; i++) { await key('Space'); await page.waitForTimeout(70); }
  await shot('7-sweep');
  await waitState('postthrow', 60000); await page.waitForTimeout(900);
  await shot('8-house');

  // ICE LAB (the I key): the truth overlay, speed map then curl map, on the
  // next aiming screen. Set directly so the on-screen flash is not in shot.
  await waitFor(() => !window.__C94.cpuTurn && window.__C94.state === 'curl', 'the next handle choice', 90000);
  await key('Space'); await waitState('aim'); await page.waitForTimeout(300);
  await game(() => { window.__C94.iceLab = 1; }); await page.waitForTimeout(120);
  await shot('8b-ice-lab-speed');
  await game(() => { window.__C94.iceLab = 2; }); await page.waitForTimeout(120);
  await shot('8c-ice-lab-curl');
  await game(() => { window.__C94.iceLab = 0; });

  // play out the end with quick throws to reach the scoreboard and the ice log
  for (let guard = 0; guard < 6000; guard++) {
    const s = await state();
    if (s === 'endscore' || s === 'gameover') break;
    const cpu = await game(() => window.__C94.cpuTurn);
    if (!cpu && s === 'aim') {
      await page.keyboard.down('Space'); await page.waitForTimeout(330); await page.keyboard.up('Space');
    } else if (!cpu && (s === 'prethrow' || s === 'curl' || s === 'slide')) await key('Space');
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(400);
  await shot('9-endscore');
  await key('Space'); await waitState('icelog'); await page.waitForTimeout(500);
  await shot('9b-ice-log');

  await browser.close();
  if (errors.length) { console.error('page errors:', errors); process.exit(1); }
  console.log('saved:', fs.readdirSync(outDir).filter(f => /^\d/.test(f)).join(', '));
})().catch(e => { console.error(e); process.exit(1); });
