// Full-game smoke test: loads the real game scripts against a stubbed
// canvas and plays a complete seeded game against the CPU.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);

// ---- DOM stubs
const calls = { fillRect: 0 };
const ctx2d = { imageSmoothingEnabled: false, fillStyle: '#000', fillRect() { calls.fillRect++; } };
globalThis.document = { getElementById: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
globalThis.window = {};
const handlers = {};
globalThis.addEventListener = (ev, fn) => { handlers[ev] = fn; };
globalThis.requestAnimationFrame = () => {};

// index.html's own script list, in order, exactly as the browser loads it
vm.runInThisContext(
  scripts.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n') +
  '\n;globalThis.__T = { G, update, draw, seedGame, evalEnd, setThrowMode, vOfPower };',
  { filename: 'game-bundle.js' });
const T = globalThis.__T, G = T.G;

const press = code => handlers.keydown({ code, repeat: false, preventDefault() {} });
const release = code => handlers.keyup({ code });
const tapKey = code => { press(code); release(code); };
const step = n => { for (let i = 0; i < (n || 1); i++) { T.update(1 / 60); T.draw(); } };

test('index.html loads physics before the game', () => {
  assert.deepEqual(scripts, ['physics.js', 'game.js']);
});

test('a full seeded game against the CPU plays through to a winner', () => {
  T.seedGame(1994);
  assert.equal(G.state, 'title');
  tapKey('Enter'); step(2);
  assert.equal(G.state, 'menu');
  tapKey('ArrowDown'); step(1); tapKey('ArrowLeft'); step(1); // stones: 4 -> 2
  assert.equal(G.rocksPer, 2);
  tapKey('Enter'); step(2);
  assert.equal(G.state, 'prethrow');

  let frames = 0, throwsSeen = 0, lastState = '';
  const splits = [], hths = [];
  while (G.state !== 'gameover' && frames < 60 * 60 * 30) {
    if (G.state !== lastState) {
      if (G.state === 'slide') throwsSeen++;
      if (lastState === 'slide') {
        if (G.watch.split !== null) splits.push(G.watch.split);
        if (G.watch.hth !== null) hths.push(G.watch.hth);
      }
      lastState = G.state;
    }
    const human = !G.cpuTurn, s = G.state;
    if (['prethrow', 'curl', 'aim', 'power', 'endscore'].includes(s)) {
      if ((human || s === 'endscore' || s === 'prethrow') && frames % 20 === 0) tapKey('Space');
    } else if (s === 'slide' && human && frames % 8 === 0) tapKey('Space');
    step(1); frames++;
  }

  assert.equal(G.state, 'gameover', `stuck in ${G.state} after ${frames} frames`);
  assert.ok(throwsSeen >= 8, `only ${throwsSeen} throws`);
  assert.ok(Number.isInteger(G.scores[0]) && Number.isInteger(G.scores[1]));
  assert.notEqual(G.scores[0], G.scores[1]);
  assert.equal(G.gameWinner, G.scores[0] > G.scores[1] ? 0 : 1);
  assert.ok(calls.fillRect > 1000, 'renderer drew');
  assert.ok(splits.length > 0 && splits.every(t => t > 1.5 && t < 9), `splits ${splits.map(t => t.toFixed(2))}`);
  assert.ok(hths.length > 0 && hths.every(t => t > 5 && t < 30), `hog-to-hog ${hths.map(t => t.toFixed(2))}`);

  step(70); // the champions splash ignores input for its first second
  tapKey('Enter'); step(2);
  assert.equal(G.state, 'title');
});

test('the same seed replays the same game', () => {
  const play = seed => {
    T.seedGame(seed);
    tapKey('Enter'); step(2); tapKey('Enter'); step(2);
    const log = [];
    for (let f = 0; f < 60 * 60 * 30 && G.state !== 'gameover'; f++) {
      if (f % 20 === 0 && G.state !== 'slide') tapKey('Space');
      if (G.state === 'postthrow' && G.st < 0.02) log.push(G.stones.map(s => [s.y, s.z, s.alive]));
      step(1);
    }
    const result = { scores: [...G.scores], log };
    step(70); tapKey('Enter'); step(2);
    return result;
  };
  const a = play(7), b = play(7), c = play(8);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.log, c.log);
});

test('scoring counts stones closer than the opponent\'s best', () => {
  const at = (team, d) => ({ team, y: 38.35 + d, z: 0, alive: true });
  G.stones = [at(0, 0.2), at(0, 0.6), at(1, 0.9), at(0, 1.4), at(1, 5)];
  assert.deepEqual(T.evalEnd(), { winner: 0, pts: 2 });
  G.stones = [at(1, 3), at(0, 4)];
  assert.deepEqual(T.evalEnd(), { winner: -1, pts: 0 });
});

test('HOLD throw mode: one pass of the bar, released with the key', () => {
  const toAim = () => {
    T.seedGame(3);
    tapKey('Enter'); step(2); tapKey('Enter'); step(2);     // title -> menu -> first throw
    tapKey('Space'); step(2); tapKey('Space'); step(2);     // banner -> handle -> aim
    assert.equal(G.state, 'aim');
  };
  const backToTitle = () => { G.state = 'gameover'; G.st = 2; G.gameWinner = 0; tapKey('Enter'); step(2); };

  T.setThrowMode(1);
  toAim();
  press('Space'); step(1);
  assert.equal(G.state, 'power');
  let last = -1;
  for (let i = 0; i < 20; i++) { step(1); assert.ok(G.power > last, 'bar only climbs'); last = G.power; }
  release('Space'); step(1);
  assert.equal(G.state, 'deliver');
  assert.ok(G.power > 0.3 && G.power < 0.6, `released at ${G.power}`);
  assert.equal(G.vRelease, T.vOfPower(G.power));
  backToTitle();

  toAim();
  press('Space'); step(120);                                // never let go: tops out and throws
  assert.notEqual(G.state, 'power');
  assert.equal(G.power, 1);
  release('Space');
  backToTitle();
  T.setThrowMode(0);
});
