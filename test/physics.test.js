// Physics calibration. These pin the numbers the game was tuned to in
// playtests; if one fails, the feel of the game has changed.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../physics.js');

const FT = 0.3048;
const ice = P.makeIce();
const near = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: got ${actual.toFixed(4)}, want ${expected} ± ${tol}`);
const game = { dt: (1 / 60) * 2.4 / 4 };   // the live game's step at 60fps

test('a draw to the button reads 14.0s hog-to-hog and a 3.77s split', () => {
  const r = P.simulateShot(ice, P.speedToStopAt(ice, P.TEE), 0, 1, game);
  near(r.hth, 14.0, 0.1, 'hog-to-hog');
  near(r.split, 3.77, 0.05, 'split');
  near(r.y, P.TEE, 0.2, 'stop position');
  assert.equal(r.out, false);
});

test('heavier weight reads shorter times, in the range of real timing tables', () => {
  const normal = P.simulateShot(ice, 2.95, 0, 1, game), peel = P.simulateShot(ice, 3.45, 0, 1, game);
  near(normal.split, 2.75, 0.15, 'normal hit split');
  near(peel.split, 2.37, 0.15, 'peel split');
  assert.ok(peel.hth < normal.hth && normal.hth < 14.0);
});

test('a draw curls about 4.8 feet, toward the handle', () => {
  const v = P.speedToStopAt(ice, P.TEE);
  const cw = P.simulateShot(ice, v, 0, 1, game), ccw = P.simulateShot(ice, v, 0, -1, game);
  near(cw.z / FT, 4.8, 0.2, 'clockwise curl (ft, + = right)');
  assert.equal(ccw.z, -cw.z, 'counter-clockwise mirrors clockwise exactly');
});

test('a stone never moves against its handle', () => {
  for (const v of [2.0, P.speedToStopAt(ice, P.TEE), 2.6, 3.1, 4.0]) {
    const s = P.releasedStone(v, 0, 1);
    while (P.stepStone(s, game.dt, ice, 0) && s.y < P.BACK) assert.ok(s.z >= 0, `v=${v}: z=${s.z}`);
  }
});

test('heavy weight runs straight: peels exactly, normal hits within 5cm', () => {
  for (const spin of [1, -1]) {
    assert.equal(P.simulateShot(ice, 4.0, 0, spin, game).z, 0, 'peel');
    assert.ok(Math.abs(P.simulateShot(ice, 3.1, 0, spin, game).z) < 0.05, 'normal hit');
  }
});

test('sweeping carries a stone farther and holds it straighter', () => {
  const v = P.speedToStopAt(ice, P.FHOG + 3);
  const dry = P.simulateShot(ice, v, 0, 1, game), swept = P.simulateShot(ice, v, 0, 1, { ...game, sweep: 1 });
  assert.ok(swept.y - dry.y > 2, `carry ${(swept.y - dry.y).toFixed(2)}m`);
  assert.ok(swept.z < dry.z * 0.6, `curl ${swept.z.toFixed(2)} vs ${dry.z.toFixed(2)}`);
});

test('results do not depend on frame rate or on the offline step size', () => {
  const v = P.speedToStopAt(ice, P.TEE);
  const at = dt => P.simulateShot(ice, v, 0, 1, { dt });
  const f30 = at((1 / 30) * 2.4 / 4), f144 = at((1 / 144) * 2.4 / 4), offline = at(0.06);
  near(f30.y, f144.y, 0.03, '30fps vs 144fps stop');
  near(offline.y, f144.y, 0.08, 'offline sim vs 144fps stop');
  near(offline.z, f144.z, 0.02, 'offline sim vs 144fps curl');
});

test('aim solver puts a draw on its target', () => {
  const v = P.speedToStopAt(ice, P.TEE);
  for (const [spin, tz] of [[1, 0], [-1, 0.5], [1, -0.8]]) {
    const r = P.simulateShot(ice, v, P.solveAim(ice, v, spin, P.TEE, tz), spin);
    near(r.z, tz, 0.15, `spin ${spin} target ${tz}`);
  }
});

test('collisions: a nose hit passes on the shooter\'s speed and conserves momentum', () => {
  const a = { y: 0, z: 0, vy: 2, vz: 0, spin: 1, rot: 0, alive: true }, b = { y: 0.49, z: 0, vy: 0, vz: 0, spin: 1, rot: 0, alive: true };
  const ev = [];
  P.stepWorld([a, b], 1e-6, { decelAt: () => 0, curlAt: () => 0 }, null, 0, ev);
  assert.equal(ev.length, 1); assert.equal(ev[0].type, 'hit');
  near(a.vy + b.vy, 2, 1e-9, 'momentum');
  near(b.vy, 2 * (1 + P.RESTITUTION) / 2, 1e-9, 'struck stone speed');
  assert.ok(a.touched && b.touched);
});

test('stones leave play at the boards and through the back line', () => {
  const ev = [], side = P.releasedStone(3, 0.4, 1), deep = P.releasedStone(4, 0, 1);
  for (let i = 0; i < 20000 && (side.alive || deep.alive); i++) P.stepWorld([side, deep], 0.01, ice, null, 0, ev);
  assert.deepEqual(ev.map(e => e.type).sort(), ['boards', 'through']);
});

test('the weight bar is monotonic, invertible, and puts the draw mid-bar', () => {
  let last = -1;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const v = P.vOfPower(p);
    assert.ok(v > last); last = v;
    near(P.powerOfV(v), Math.min(p, 1), 1e-9, 'round trip');
  }
  near(P.powerOfV(P.speedToStopAt(ice, P.TEE)), 0.555, 0.005, 'draw position');
  near(P.vOfPower(1), P.V_MAX, 1e-12, 'top of bar');
});

test('weight helpers follow ice that is not uniform', () => {
  // keen first half, heavy second half, and swingier on the right
  const patchy = { decelAt: y => (y < 24 ? 0.070 : 0.095), curlAt: (y, z) => (z > 0 ? 0.014 : 0.008) };
  const v = P.speedToStopAt(patchy, P.TEE);
  assert.ok(Math.abs(v - P.speedToStopAt(ice, P.TEE)) > 0.01, 'speed differs from uniform ice');
  const straight = P.simulateStone(patchy, { ...P.releasedStone(v, 0, 1), spin: 0 }, game);
  near(straight.y, P.TEE, 0.05, 'stops where asked on patchy ice');
  const right = P.simulateShot(patchy, v, 0, 1, game), left = P.simulateShot(patchy, v, 0, -1, game);
  assert.ok(right.z > -left.z * 1.3, 'the swingy side curls more');
  const s = P.releasedStone(v, 0, 1); s.spin = 0;
  near(s.y + P.coastDistance(patchy, s), P.TEE, 0.05, 'coast projection');
});

test('seeded randomness is reproducible', () => {
  const a = P.makeRng(94), b = P.makeRng(94), c = P.makeRng(95);
  const xs = Array.from({ length: 5 }, a), ys = Array.from({ length: 5 }, b), zs = Array.from({ length: 5 }, c);
  assert.deepEqual(xs, ys); assert.notDeepEqual(xs, zs);
  assert.ok(xs.every(x => x >= 0 && x < 1));
});

// ---------------------------------------------------------- living ice
const sheets = Array.from({ length: 300 }, (_, i) => P.makeLivingIce((i + 1) * 7919));
const drawOn = sheet => P.simulateShot(sheet, P.speedToStopAt(sheet, P.TEE), 0, 1, game);

test('living ice: a sheet is reproducible from its seed', () => {
  const sample = sheet => [sheet.baseHth, sheet.decelAt(20, 0.5), sheet.curlAt(35, -1)];
  assert.deepEqual(sample(P.makeLivingIce(42)), sample(P.makeLivingIce(42)));
  assert.notDeepEqual(sample(P.makeLivingIce(42)), sample(P.makeLivingIce(43)));
});

test('living ice: base speed is mostly ~14.0, sometimes ~13.5 or ~15.0', () => {
  const share = hth => sheets.filter(s => s.report().hth === hth).length / sheets.length;
  near(share(14), 0.6, 0.08, 'share of 14.0 sheets');
  near(share(13.5), 0.2, 0.07, 'share of 13.5 sheets');
  near(share(15), 0.2, 0.07, 'share of 15.0 sheets');
  assert.ok(sheets.every(s => s.baseHth > 13.3 && s.baseHth < 15.2));
});

test('living ice: fresh pebble is slow, then keens up to the base speed', () => {
  for (const seed of [11, 222, 3333, 44444]) {
    const sheet = P.makeLivingIce(seed);
    const first = drawOn(sheet).hth;
    for (let i = 0; i < 3; i++) sheet.stoneThrown();
    const third = drawOn(sheet).hth;
    for (let i = 0; i < 9; i++) sheet.stoneThrown();
    const keen = drawOn(sheet).hth;
    assert.ok(keen - first > 0.5 && keen - first < 1.0, `first stone ${first.toFixed(2)} vs keen ${keen.toFixed(2)}`);
    assert.ok(third > first && third < keen, 'keening up in between');
    near(keen, sheet.baseHth, 0.3, 'keen speed vs base');
  }
});

test('living ice: a long game breaks the pebble down, slower and straighter', () => {
  const sheet = P.makeLivingIce(5);
  for (let i = 0; i < 25; i++) sheet.stoneThrown();
  const mid = [sheet.hthNow(), sheet.curlAt(35, 0)];
  for (let i = 0; i < 60; i++) sheet.stoneThrown();
  assert.ok(sheet.hthNow() < mid[0] - 0.4);
  assert.ok(sheet.curlAt(35, 0) < mid[1] * 0.85);
});

test('living ice: conditions stay within believable bounds everywhere', () => {
  for (const sheet of sheets.slice(0, 60)) {
    for (let i = 0; i < 12; i++) sheet.stoneThrown();
    const base = P.decelForHth(sheet.baseHth);
    for (let y = 9; y <= 40; y += 3) for (let z = -2.2; z <= 2.2; z += 0.55) {
      const a = sheet.decelAt(y, z), c = sheet.curlAt(y, z);
      assert.ok(a > base * 0.9 && a < base * 1.15, `decel ${a} at ${y},${z}`);
      assert.ok(c > 0, `curl ${c}`);
    }
    const feet = drawOn(sheet).z / FT;
    assert.ok(feet > 3.3 && feet < 6.6, `draw curls ${feet.toFixed(1)} ft (report says ${sheet.report().feet})`);
  }
});

test('living ice: the edges are heavier and one side swings more', () => {
  const sheet = P.makeLivingIce(77);
  const meanDecel = z => [12, 18, 24, 30, 36].reduce((sum, y) => sum + sheet.decelAt(y, z), 0) / 5;
  assert.ok(meanDecel(2.2) > meanDecel(0) * 1.02 && meanDecel(-2.2) > meanDecel(0) * 1.02);
  const meanCurl = z => [12, 18, 24, 30, 36].reduce((sum, y) => sum + sheet.curlAt(y, z), 0) / 5;
  const swingy = Math.sign(sheet.swingSide);
  assert.ok(meanCurl(1.5 * swingy) > meanCurl(-1.5 * swingy) * 1.05);
});

test('living ice: stones polish the lane they travel, and only that lane', () => {
  const sheet = P.makeLivingIce(9);
  const before = [sheet.decelAt(25, 0), sheet.curlAt(25, 0), sheet.decelAt(25, 1.5)];
  for (let i = 0; i < 8; i++) {
    const s = P.releasedStone(2.3, 0, 0);   // straight down the centre line
    while (s.alive && P.isMoving(s)) P.stepWorld([s], game.dt, sheet, null, 0, []);
  }
  assert.ok(sheet.wearAt(25, 0) > 0.5);
  assert.ok(sheet.decelAt(25, 0) < before[0] * 0.985, 'lane is quicker');
  assert.ok(sheet.curlAt(25, 0) < before[1] * 0.95, 'lane is straighter');
  assert.equal(sheet.decelAt(25, 1.5), before[2], 'ice off the lane is untouched');
  const planning = P.makeLivingIce(9), probe = planning.decelAt(25, 0);
  P.simulateShot(planning, 2.3, 0, 1);
  assert.equal(planning.decelAt(25, 0), probe, 'offline simulation never wears the ice');
});

test('living ice: weight helpers still put a stone where asked', () => {
  for (const sheet of sheets.slice(0, 40)) {
    const v = P.speedToStopAt(sheet, P.TEE);
    const straight = P.simulateStone(sheet, { ...P.releasedStone(v, 0, 1), spin: 0 }, game);
    near(straight.y, P.TEE, 0.05, 'straight stone stops on the tee line');
  }
});

test('speed and curl conversions agree with the simulation', () => {
  for (const hth of [13.5, 14, 15]) {
    const a = P.decelForHth(hth);
    near(P.hthForDecel(a), hth, 1e-9, 'round trip');
    const flat = P.makeIce({ decel: a, curl: P.curlForFeet(5, a) });
    const r = P.simulateShot(flat, P.speedToStopAt(flat, P.TEE), 0, 1, game);
    near(r.hth, hth, 0.1, `simulated hog-to-hog on ${hth} ice`);
    near(r.z / FT, 5, 0.35, `simulated curl on ${hth} ice`);
  }
});
