// Screenshot capture script (dev only). Drives the game in headless
// chromium and saves PNGs of each major screen to ./shots/.
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync(__dirname + '/shots', { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 820, height: 800 } });
  await page.goto('file://' + __dirname + '/index.html');
  const cv = page.locator('#game');
  const state = () => page.evaluate(() => window.__C94.state);
  const waitState = async (s, ms = 15000) => {
    const t0 = Date.now();
    while (await state() !== s) {
      if (Date.now() - t0 > ms) throw new Error('timeout waiting for ' + s + ', at ' + await state());
      await page.waitForTimeout(50);
    }
  };
  const shot = n => cv.screenshot({ path: `${__dirname}/shots/${n}.png` });

  await page.waitForTimeout(900);
  await shot('1-title');

  await page.keyboard.press('Enter');
  await waitState('menu');
  await page.waitForTimeout(300);
  await shot('2-menu');

  await page.keyboard.press('Enter');
  await waitState('prethrow');
  await page.waitForTimeout(600);
  await shot('3-prethrow');

  await page.keyboard.press('Space'); // skip banner
  await waitState('aim');
  await page.waitForTimeout(450);
  await shot('4-aim');

  await page.keyboard.press('Space'); // lock aim
  await waitState('curl');
  await page.waitForTimeout(200);
  await shot('5-curl');

  await page.keyboard.press('Space'); // confirm handle
  await waitState('power');
  await page.waitForTimeout(610);     // ride the meter up near draw weight
  await shot('6-power');

  await page.keyboard.press('Space'); // release!
  await waitState('slide');
  // sweep like mad so the sweepers show up
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(90); }
  await shot('7-sweep');
  await waitState('postthrow', 45000);
  await page.waitForTimeout(800);
  await shot('8-house');

  // fast-forward the rest of the game to the end-score splash
  for (let guard = 0; guard < 4000; guard++) {
    const s = await state();
    if (s === 'endscore' || s === 'gameover') break;
    const human = await page.evaluate(() => !(window.__C94.mode === 1 && window.__C94.team === 1));
    if (['prethrow', 'aim', 'curl', 'power'].includes(s) && human) await page.keyboard.press('Space');
    if (s === 'slide' && human) await page.keyboard.press('Space');
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(500);
  await shot('9-endscore');

  console.log('screens captured:', fs.readdirSync(__dirname + '/shots').join(', '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
