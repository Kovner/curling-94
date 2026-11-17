// Full-game tests: load the real game scripts against a stubbed canvas
// and play seeded games against the CPU.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../physics.js');

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
  '\n;globalThis.__T = { G, update, draw, seedGame, evalEnd, vOfPower, cpuWatchIce, skipViewWindow };',
  { filename: 'game-bundle.js' });
const T = globalThis.__T, G = T.G;

const press = code => handlers.keydown({ code, repeat: false, preventDefault() {} });
const release = code => handlers.keyup({ code });
const tapKey = code => { press(code); release(code); };
const step = n => { for (let i = 0; i < (n || 1); i++) { T.update(1 / 60); T.draw(); } };

// A simple player: taps through the cards, holds Space from the aim lock
// until the weight bar reaches `weight`, and sweeps a little.
function botFrame(frame, weight) {
  const s = G.state, human = !G.cpuTurn;
  if (['icereport', 'prethrow', 'endscore', 'icelog'].includes(s)) { if (frame % 20 === 0) tapKey('Space'); }
  else if (!human) return;
  else if (s === 'curl') { if (frame % 20 === 0) tapKey('Space'); }
  else if (s === 'aim') { if (frame % 20 === 0) press('Space'); }
  else if (s === 'power') { if (G.power >= weight) release('Space'); }
  else if (s === 'slide') { if (frame % 8 === 0) tapKey('Space'); }
}
function newGame(seed) {
  T.seedGame(seed);
  assert.equal(G.state, 'title');
  tapKey('Enter'); step(2);
  assert.equal(G.state, 'menu');
  tapKey('Enter'); step(2);
}
function abandonGame() { release('Space'); G.state = 'gameover'; G.st = 2; G.gameWinner = 0; tapKey('Enter'); step(2); }
function toAim() {
  step(30); tapKey('Space'); step(2);                       // ice report -> first throw
  tapKey('Space'); step(2); tapKey('Space'); step(2);       // banner -> handle -> aim
  assert.equal(G.state, 'aim');
}

test('index.html loads physics before the game', () => {
  assert.deepEqual(scripts, ['physics.js', 'game.js']);
});

test('a full seeded game against the CPU plays through to a winner', () => {
  T.seedGame(1994);
  tapKey('Enter'); step(2);
  tapKey('ArrowDown'); step(1); tapKey('ArrowLeft'); step(1); // stones: 4 -> 2
  assert.equal(G.rocksPer, 2);
  tapKey('Enter'); step(2);
  assert.equal(G.state, 'icereport');
  assert.ok(G.ice.report().hth >= 13.5 && G.ice.report().hth <= 15);

  let frames = 0, throwsSeen = 0, sawIceLog = 0, lastState = '';
  const splits = [], hths = [];
  while (G.state !== 'gameover' && frames < 60 * 60 * 30) {
    if (G.state !== lastState) {
      if (G.state === 'slide') throwsSeen++;
      if (G.state === 'icelog') sawIceLog++;
      if (lastState === 'slide') {
        if (G.watch.split !== null) splits.push(G.watch.split);
        if (G.watch.hth !== null) hths.push(G.watch.hth);
      }
      lastState = G.state;
    }
    botFrame(frames, 0.58); step(1); frames++;
  }

  assert.equal(G.state, 'gameover', `stuck in ${G.state} after ${frames} frames`);
  assert.ok(throwsSeen >= 8, `only ${throwsSeen} throws`);
  assert.equal(G.iceLog.length, throwsSeen, 'one ice read per stone');
  assert.ok(G.iceLog.every(e => e.line > 12 && e.line < 16 && e.sheet > 12 && e.sheet < 16));
  assert.ok(G.iceLog[G.iceLog.length - 1].sheet - G.iceLog[0].sheet > 0.3, 'the log shows the sheet keening up');
  assert.ok(sawIceLog >= 2, 'ice log shown after each end');
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
    newGame(seed);
    const log = [];
    for (let f = 0; f < 60 * 60 * 30 && G.state !== 'gameover'; f++) {
      if (G.state === 'postthrow' && G.st < 0.02) log.push(G.stones.map(s => [s.y, s.z, s.alive]));
      botFrame(f, 0.55); step(1);
    }
    const result = { scores: [...G.scores], log, ice: G.iceLog.map(e => e.line) };
    step(70); tapKey('Enter'); step(2);
    return result;
  };
  const a = play(7), b = play(7), c = play(8);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.log, c.log);
  assert.ok(a.log.some(stones => stones.some(s => s[2])), 'the bot gets stones to stay in play');
});

test('scoring counts stones closer than the opponent\'s best', () => {
  const at = (team, d) => ({ team, y: 38.35 + d, z: 0, alive: true });
  G.stones = [at(0, 0.2), at(0, 0.6), at(1, 0.9), at(0, 1.4), at(1, 5)];
  assert.deepEqual(T.evalEnd(), { winner: 0, pts: 2 });
  G.stones = [at(1, 3), at(0, 4)];
  assert.deepEqual(T.evalEnd(), { winner: -1, pts: 0 });
  G.stones = [];
});

test('the throw is one motion: press locks the aim, the bar climbs once, release throws', () => {
  newGame(3); toAim();
  press('Space'); step(1);
  assert.equal(G.state, 'power');
  const locked = G.aimAng;
  let last = -1;
  for (let i = 0; i < 16; i++) { step(1); assert.ok(G.power > last, 'bar only climbs'); last = G.power; }
  release('Space'); step(1);
  assert.equal(G.state, 'deliver');
  assert.equal(G.aimAng, locked);
  assert.ok(G.power > 0.4 && G.power < 0.6, `released at ${G.power}`);
  assert.equal(G.vRelease, T.vOfPower(G.power));
  abandonGame();

  newGame(3); toAim();
  press('Space'); step(90);                                 // never let go: tops out and throws
  assert.notEqual(G.state, 'power');
  assert.equal(G.power, 1);
  abandonGame();
});

test('the CPU skip learns the ice by watching stones', () => {
  newGame(2026);
  assert.equal(G.state, 'icereport');
  const truth = () => { const v = P.speedToStopAt(G.ice, P.TEE); return (v * v) / (2 * (P.TEE - P.RELEASE_Y)); };
  assert.equal(G.cpuIce.decel, P.decelForHth(G.ice.report().hth), 'starts from the icemaker\'s report');
  const errorAtFirstStone = Math.abs(G.cpuIce.decel - truth());
  assert.ok(errorAtFirstStone > 0.004, 'the report is wrong about fresh pebble');
  for (let i = 0; i < 6; i++) { G.ice.stoneThrown(); T.cpuWatchIce(); }
  assert.ok(Math.abs(G.cpuIce.decel - truth()) < errorAtFirstStone / 5, 'belief has closed in on the sheet');
  abandonGame();
});

test('perfect ice is the nominal sheet, with no report and no ice lab', () => {
  const toggleIce = () => {
    tapKey('Enter'); step(2);
    assert.equal(G.state, 'menu');
    while (G.menuSel !== 3) { tapKey('ArrowDown'); step(1); }   // the ICE row
    tapKey('ArrowRight'); step(1);
  };
  T.seedGame(5);
  toggleIce();
  assert.equal(G.livingIce, false);
  tapKey('Enter'); step(2);
  assert.equal(G.state, 'prethrow');
  assert.equal(G.ice.decelAt(20, 1), P.ICE_DECEL);
  assert.equal(G.ice.curlAt(20, 1), P.ICE_CURL);
  tapKey('KeyI'); step(1);
  assert.equal(G.iceLab, 0, 'no ice lab on perfect ice');
  abandonGame();
  toggleIce();
  assert.equal(G.livingIce, true);
  G.state = 'title';
});

test('the skip cam stretches down the sheet to show guards', () => {
  const at = (y, alive = true) => ({ team: 0, y, z: 0.3, alive });
  G.stones = [at(38)];
  const house = T.skipViewWindow();
  assert.ok(house.bottom > P.TEE - P.HOUSE_R - 0.5 && house.top > P.BACK, 'house only');
  G.stones = [at(38), at(34.2), at(33.1, false)];
  assert.ok(T.skipViewWindow().bottom < 34.2 - 0.5, 'takes in the guard');
  assert.ok(T.skipViewWindow().bottom > 33.1, 'ignores a stone that is out of play');
  G.stones = [at(32.1)];
  assert.ok(T.skipViewWindow().bottom >= P.FHOG - 0.4 && T.skipViewWindow().bottom < 32.1, 'reaches the far hog line');
  G.stones = [];
});

test('ice lab: I cycles the truth overlay and ] ages the pebble', () => {
  newGame(11); toAim();
  const before = G.ice.hthNow();
  tapKey('KeyI'); step(1);
  assert.equal(G.iceLab, 1);
  for (let i = 0; i < 5; i++) { tapKey('BracketRight'); step(1); }
  assert.equal(G.ice.stonesThrown, 5);
  assert.ok(G.ice.hthNow() - before > 0.3, 'five stones of wear keen the sheet up');
  tapKey('KeyI'); step(1); assert.equal(G.iceLab, 2);
  tapKey('KeyI'); step(1); assert.equal(G.iceLab, 0);
  tapKey('BracketRight'); step(1);
  assert.equal(G.ice.stonesThrown, 5, '] does nothing with the lab off');
  abandonGame();
});
