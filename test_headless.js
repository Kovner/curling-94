// Headless smoke test for game.js — not shipped to the browser.
// Stubs canvas/DOM, drives a full VS-CPU game, checks physics calibration.
'use strict';
const fs = require('fs');
const vm = require('vm');

// ---- DOM stubs
const calls = { fillRect: 0 };
const ctx = {
  imageSmoothingEnabled: false,
  fillStyle: '#000',
  fillRect() { calls.fillRect++; },
};
const canvas = { width: 0, height: 0, getContext: () => ctx };
globalThis.document = { getElementById: () => canvas };
globalThis.window = {};
const handlers = {};
globalThis.addEventListener = (ev, fn) => { handlers[ev] = fn; };
let rafCb = null;
globalThis.requestAnimationFrame = fn => { rafCb = fn; };

const code = fs.readFileSync(__dirname + '/game.js', 'utf8');
vm.runInThisContext(code + `
;globalThis.__T = { G, update, draw, simShot, V_DRAW, V_GUARD, TEE, FHOG, HOUSE_R, evalEnd, solveAim };
`, { filename: 'game.js' });
const T = globalThis.__T;
const G = T.G;

function press(codeStr) { handlers.keydown({ code: codeStr, repeat: false, preventDefault() {} }); }
function release(codeStr) { handlers.keyup({ code: codeStr }); }
function step(n) { for (let i = 0; i < (n || 1); i++) { T.update(1 / 60); T.draw(); } }

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok  ' + name);
  else { failed++; console.log('FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
}

// ---- physics calibration
const draw = T.simShot(T.V_DRAW, 0, 1);
check('draw weight stops near the button', Math.abs(draw.y - T.TEE) < 1.2, 'stopped at y=' + draw.y.toFixed(2));
check('draw curls 0.7-2.5m', Math.abs(draw.z) > 0.7 && Math.abs(draw.z) < 2.5, 'z=' + draw.z.toFixed(2));
const guard = T.simShot(T.V_GUARD, 0, -1);
check('guard weight stops between hog and house',
  guard.y > T.FHOG && guard.y < T.TEE - T.HOUSE_R, 'y=' + guard.y.toFixed(2));
const ang = T.solveAim(T.V_DRAW, 1, T.TEE, 0);
const solved = T.simShot(T.V_DRAW, ang, 1, T.TEE);
check('aim solver lands within 0.3m of target', Math.abs(solved.z) < 0.3, 'z=' + solved.z.toFixed(2));

// ---- full game vs CPU
check('boots to title', G.state === 'title');
press('Enter'); release('Enter'); step(2);
check('title -> menu', G.state === 'menu');
// shrink the match: stones=2 per end (menu row 1: 4 -> 2 needs Left once)
press('ArrowDown'); step(1); press('ArrowLeft'); step(1);
check('stones option set to 2', G.rocksPer === 2);
press('Enter'); release('Enter'); step(2);
check('menu -> prethrow', G.state === 'prethrow');

let frames = 0, throwsSeen = 0, lastState = '';
const splits = [], hths = [];
const MAXF = 60 * 60 * 30; // 30 sim-minutes cap
while (G.state !== 'gameover' && frames < MAXF) {
  if (G.state !== lastState) {
    if (G.state === 'slide') throwsSeen++;
    if (lastState === 'slide' && G.watch) {
      if (G.watch.split !== null) splits.push(G.watch.split);
      if (G.watch.hth !== null) hths.push(G.watch.hth);
    }
    lastState = G.state;
  }
  const human = !(G.mode === 1 && G.team === 1);
  const s = G.state;
  if (['prethrow', 'curl', 'aim', 'power', 'endscore'].includes(s)) {
    if (human || s === 'endscore' || s === 'prethrow') {
      if (frames % 20 === 0) { press('Space'); release('Space'); }
    }
  } else if (s === 'slide' && human && frames % 8 === 0) {
    press('Space'); release('Space');
  }
  step(1); frames++;
}
check('game reaches gameover', G.state === 'gameover', 'state=' + G.state + ' after ' + frames + ' frames');
check('every stone was thrown (>= 2 ends x 4 throws)', throwsSeen >= 8, 'throws=' + throwsSeen);
check('scores are sane numbers',
  Number.isInteger(G.scores[0]) && Number.isInteger(G.scores[1]) && G.scores[0] !== G.scores[1],
  JSON.stringify(G.scores));
check('a winner was declared', G.gameWinner === 0 || G.gameWinner === 1);
check('renderer drew pixels', calls.fillRect > 1000);
check('stopwatch recorded splits in real-curling range (2.5-5s)',
  splits.length > 0 && splits.every(t => t > 2.5 && t < 5), JSON.stringify(splits.map(t => +t.toFixed(2))));
check('stopwatch recorded hog-to-hog times in range (6-17s)',
  hths.length > 0 && hths.every(t => t > 6 && t < 17), JSON.stringify(hths.map(t => +t.toFixed(2))));

step(70); // splash ignores input for the first second
press('Enter'); release('Enter'); step(2);
check('gameover -> title', G.state === 'title');

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL TESTS PASSED');
process.exit(failed ? 1 : 0);
