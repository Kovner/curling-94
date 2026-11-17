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
