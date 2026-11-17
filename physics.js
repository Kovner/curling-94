'use strict';
/* ============================================================
   CURLING '94 — physics
   Sheet geometry, the ice model, stone integration, collisions,
   offline shot simulation and the weight scale.

   Pure: no DOM, no game state, no randomness except makeRng.
   Loaded as a plain script in the browser (these are globals that
   game.js uses) and via require() in the tests.
   ============================================================ */

// ---------------------------------------------------------- sheet geometry (meters)
// y runs up the sheet from the near hack, z is lateral (+ = right).
const SHEET_HALF = 2.375;          // half sheet width
const WALL_Z = SHEET_HALF - 0.05;  // side boards
const SLIDE_START = 0.8;           // stone sits here pre-throw, slide begins
const NBACK = 1.83;                // near back line
const NTEE = 3.66;                 // near tee line
const RELEASE_Y = 9.0;             // release just before the hog, like a real slide
const NHOG = 10.0;                 // near hog line
const FHOG = 31.95;                // far hog line
const TEE = 38.35;                 // far tee (button)
const BACK = 40.18;                // far back line
const WLEN = 41.6;                 // playable world length
const HOUSE_R = 1.83;              // 12-foot ring
const R = 0.25;                    // stone radius (chunky arcade granite)

// ---------------------------------------------------------- stone behaviour
const V_STOP = 0.04;               // below this speed a stone is at rest
const RESTITUTION = 0.92;          // granite on granite
const SWEEP_FRICTION = 0.72;       // deceleration multiplier at full sweep
const SWEEP_CURL = 0.30;           // curl multiplier at full sweep
const SPIN_RATE = 0.7;             // rad/s: ~2-3 turns per throw at any weight

// ---------------------------------------------------------- ice
// An "ice" is any object with two methods, both taking a sheet position:
//   decelAt(y, z)  sliding deceleration in m/s^2 (lower = keener ice)
//   curlAt(y, z)   lateral acceleration in m/s^2 once a stone is curling
// Everything below asks the ice instead of reading a constant, so ice that
// varies across the sheet or changes during a game only has to implement
// these two methods.
const ICE_DECEL = 0.080;           // nominal: draw to the button = 14.0s hog-to-hog
const ICE_CURL = 0.0105;           // nominal: ~4.8 ft of curl on a draw
function makeIce(o) {
  o = o || {};
  const decel = o.decel !== undefined ? o.decel : ICE_DECEL;
  const curl = o.curl !== undefined ? o.curl : ICE_CURL;
  return { decel, curl, decelAt() { return decel; }, curlAt() { return curl; } };
}

// Curl engages only below ~2 m/s, so heavy weight runs dead straight
// (shape calibrated against curling.gg's recommended model: zero lateral
// force at speed, constant lateral accel once the stone slows, cutoff
// when nearly stopped).
function curlGate(v) {
  if (v < 0.08) return 0;
  return Math.max(0, Math.min(1, (2.1 - v) / 0.4));
}

// ---------------------------------------------------------- integration
function isMoving(s) { return Math.hypot(s.vy, s.vz) > V_STOP; }

// Advance one stone by dt seconds. The only place friction and curl are
// applied: the live game and the offline simulation both come through here.
// Returns false (and zeroes the velocity) if the stone is at rest.
function stepStone(s, dt, ice, sweep) {
  const sp = Math.hypot(s.vy, s.vz);
  if (sp < V_STOP) { s.vy = 0; s.vz = 0; return false; }
  sweep = sweep || 0;
  const uy = s.vy / sp, uz = s.vz / sp;
  // friction opposing motion
  const a = ice.decelAt(s.y, s.z) * (1 - (1 - SWEEP_FRICTION) * sweep);
  s.vy -= a * uy * dt; s.vz -= a * uz * dt;
  // curl: lateral acceleration perpendicular to the velocity
  const cl = ice.curlAt(s.y, s.z) * s.spin * curlGate(sp) * (1 - (1 - SWEEP_CURL) * sweep);
  s.vy += -uz * cl * dt; s.vz += uy * cl * dt;
  s.y += s.vy * dt; s.z += s.vz * dt;
  s.rot += s.spin * SPIN_RATE * dt;
  return true;
}

// Advance every stone by dt, take stones out of play at the boards and the
// back line, and resolve stone-stone collisions. Only `active` is swept.
// Appends what happened to `events`:
//   { type: 'boards' | 'through', stone }
//   { type: 'hit', a, b, speed }      speed = closing speed along the normal
function stepWorld(stones, dt, ice, active, sweep, events) {
  for (const s of stones) {
    if (!s.alive) continue;
    if (!stepStone(s, dt, ice, s === active ? sweep : 0)) continue;
    if (ice.wearUnder) ice.wearUnder(s.y, s.z, Math.hypot(s.vy, s.vz) * dt);
    if (Math.abs(s.z) + R > WALL_Z) {
      s.alive = false; s.vy = s.vz = 0;
      events.push({ type: 'boards', stone: s });
    } else if (s.y - R > BACK) {
      s.alive = false; s.vy = s.vz = 0;
      events.push({ type: 'through', stone: s });
    }
  }
  // equal mass, mostly-elastic
  for (let i = 0; i < stones.length; i++) {
    const a = stones[i]; if (!a.alive) continue;
    for (let j = i + 1; j < stones.length; j++) {
      const b = stones[j]; if (!b.alive) continue;
      const dy = b.y - a.y, dz = b.z - a.z;
      const d = Math.hypot(dy, dz);
      if (d > 0 && d < R * 2) {
        const ny = dy / d, nz = dz / d, overlap = R * 2 - d;
        a.y -= ny * overlap / 2; a.z -= nz * overlap / 2;
        b.y += ny * overlap / 2; b.z += nz * overlap / 2;
        const van = a.vy * ny + a.vz * nz, vbn = b.vy * ny + b.vz * nz;
        if (van - vbn > 0) {
          const ja = ((1 + RESTITUTION) / 2) * (van - vbn);
          a.vy -= ja * ny; a.vz -= ja * nz;
          b.vy += ja * ny; b.vz += ja * nz;
          a.touched = b.touched = true;
          events.push({ type: 'hit', a, b, speed: van - vbn });
        }
      }
    }
  }
}

// ---------------------------------------------------------- offline simulation
// Run one stone (mutated in place) until it stops, leaves play, or passes
// o.stopAtY. No collisions. Returns where it ended and when it crossed the
// hog lines (seconds since the start, null if it never got there).
function simulateStone(ice, s, o) {
  o = o || {};
  const dt = o.dt || 0.06, sweep = o.sweep || 0;
  let t = 0, tNearHog = null, tFarHog = null, out = false;
  for (let i = 0; i < 200000; i++) {
    const py = s.y;
    if (!stepStone(s, dt, ice, sweep)) break;
    t += dt;
    if (py < NHOG && s.y >= NHOG) tNearHog = t - dt * (s.y - NHOG) / (s.y - py);
    if (py < FHOG && s.y >= FHOG) tFarHog = t - dt * (s.y - FHOG) / (s.y - py);
    if (o.stopAtY !== undefined && s.y >= o.stopAtY) break;
    if (Math.abs(s.z) + R > WALL_Z || s.y - R > BACK) { out = true; break; }
  }
  return { y: s.y, z: s.z, t, out, tNearHog, tFarHog };
}

// The stone as it leaves the thrower's hand: carried from SLIDE_START along
// the aim line at release speed v, let go at RELEASE_Y.
function releasedStone(v, ang, spin, team) {
  return {
    team: team || 0, y: RELEASE_Y, z: Math.sin(ang) * (RELEASE_Y - SLIDE_START),
    vy: v * Math.cos(ang), vz: v * Math.sin(ang),
    spin, rot: 0, alive: true, touched: false,
  };
}

// A full delivery with no other stones in the way. Adds the two times a
// curler reads off a stopwatch:
//   split  back line -> near hog (includes the carried slide)
//   hth    near hog -> far hog
function simulateShot(ice, v, ang, spin, o) {
  const r = simulateStone(ice, releasedStone(v, ang, spin), o);
  r.split = r.tNearHog === null ? null : (RELEASE_Y - NBACK) / v + r.tNearHog;
  r.hth = r.tFarHog === null || r.tNearHog === null ? null : r.tFarHog - r.tNearHog;
  return r;
}

// Aim angle that makes a shot of speed v and handle `spin` arrive at (ty, tz).
function solveAim(ice, v, spin, ty, tz) {
  let ang = Math.atan2(tz, ty - RELEASE_Y);
  for (let i = 0; i < 4; i++) {
    const r = simulateShot(ice, v, ang, spin, { stopAtY: ty });
    ang -= Math.atan2(r.z - tz, ty - RELEASE_Y);
  }
  return ang;
}

// ---------------------------------------------------------- weight on a given ice
// Energy bookkeeping along a straight line: v^2 / 2 = integral of decel ds.
// Curl makes the real path a little longer than the straight line, so a
// stone thrown at exactly this speed comes up a few centimetres short.

// Release speed that stops a stone at yStop when thrown straight up line z.
function speedToStopAt(ice, yStop, z) {
  z = z || 0;
  const n = Math.max(1, Math.ceil((yStop - RELEASE_Y) / 0.25)), ds = (yStop - RELEASE_Y) / n;
  let work = 0;
  for (let i = 0; i < n; i++) work += ice.decelAt(RELEASE_Y + (i + 0.5) * ds, z) * ds;
  return Math.sqrt(2 * work);
}

// How much farther a moving stone will coast along its current heading.
function coastDistance(ice, s) {
  const sp = Math.hypot(s.vy, s.vz);
  if (sp < V_STOP) return 0;
  const uy = s.vy / sp, uz = s.vz / sp, ds = 0.25;
  let energy = sp * sp / 2, d = 0;
  for (let i = 0; i < 400; i++) {
    const a = ice.decelAt(s.y + uy * (d + ds / 2), s.z + uz * (d + ds / 2));
    if (a * ds >= energy) return d + energy / a;
    energy -= a * ds; d += ds;
  }
  return d;
}

// ---------------------------------------------------------- the weight scale
// What the thrower controls is release speed. The power bar maps its
// position p (0..1) to a speed, laid out so the bar is linear in where the
// stone would stop on NOMINAL ice rather than linear in speed: stopping
// distance goes with v^2, so a speed-linear bar squeezed the whole house
// into ~7% of its travel. Bands:
//   0..P_HOG        short/hogged ramp
//   P_HOG..P_BACKX  placement zone, linear in stop position hog -> back line
//   P_BACKX..1      hit weights (takeouts are tolerant, they get less bar)
// The scale is fixed to nominal ice on purpose: the same bar position is
// always the same throw, and the ice on the day decides where it ends up.
const V_MIN = 1.4, V_MAX = 4.1;
const P_HOG = 0.12, P_BACKX = 0.68;
function nominalSpeedToStopAt(yStop) { return Math.sqrt(2 * ICE_DECEL * (yStop - RELEASE_Y)); }
const V_HOG = nominalSpeedToStopAt(FHOG);
const V_BACK = nominalSpeedToStopAt(BACK);
function vOfPower(p) {
  if (p <= P_HOG) return V_MIN + (V_HOG - V_MIN) * (p / P_HOG);
  if (p <= P_BACKX) {
    return nominalSpeedToStopAt(FHOG + (BACK - FHOG) * ((p - P_HOG) / (P_BACKX - P_HOG)));
  }
  return V_BACK + (V_MAX - V_BACK) * ((p - P_BACKX) / (1 - P_BACKX));
}
function powerOfV(v) {
  if (v <= V_HOG) return Math.max(0, (v - V_MIN) / (V_HOG - V_MIN)) * P_HOG;
  if (v <= V_BACK) {
    const yStop = RELEASE_Y + (v * v) / (2 * ICE_DECEL);
    return P_HOG + (P_BACKX - P_HOG) * ((yStop - FHOG) / (BACK - FHOG));
  }
  return P_BACKX + (1 - P_BACKX) * Math.min(1, (v - V_BACK) / (V_MAX - V_BACK));
}

// ---------------------------------------------------------- living ice
// Uniform ice of deceleration a gives a draw to the button this hog-to-hog
// time, and vice versa (constant deceleration from each hog line to the tee).
const HTH_K = Math.sqrt(TEE - NHOG) - Math.sqrt(TEE - FHOG);
function decelForHth(seconds) { return 2 * HTH_K * HTH_K / (seconds * seconds); }
function hthForDecel(a) { return Math.sqrt(2 / a) * HTH_K; }
// Curl coefficient that bends a draw `feet` on uniform ice of deceleration a
// (4.8 ft on nominal ice; slower ice gives the stone less time to curl).
function curlForFeet(feet, a) { return ICE_CURL * (feet / 4.8) * (a / ICE_DECEL) * (a / ICE_DECEL); }

// What a skip would say the ice is running at down one aim line: the
// hog-to-hog seconds of a draw to the button on ice as fast as that line's
// average from release to the tee. Unlike a stone's own hog-to-hog time it
// does not depend on how hard anything was thrown.
function iceSpeedOnLine(ice, ang) {
  const slope = Math.tan(ang || 0), n = Math.ceil((TEE - RELEASE_Y) / 0.25), ds = (TEE - RELEASE_Y) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const y = RELEASE_Y + (i + 0.5) * ds;
    sum += ice.decelAt(y, slope * (y - SLIDE_START));
  }
  return hthForDecel(sum / n);
}

const NOISE_NY = 8, NOISE_NZ = 4;            // coarse patches: ~6m long, ~1.6m wide
const WEAR_NY = 42, WEAR_NZ = 20;            // traffic grid: 1m x 0.25m cells
function noiseGrid(rng) {
  const g = new Float32Array((NOISE_NY + 1) * (NOISE_NZ + 1));
  for (let i = 0; i < g.length; i++) g[i] = rng() * 2 - 1;
  return g;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function noiseAt(g, y, z) {
  const fy = Math.max(0, Math.min(NOISE_NY - 1e-6, (y / WLEN) * NOISE_NY));
  const fz = Math.max(0, Math.min(NOISE_NZ - 1e-6, ((z + SHEET_HALF) / (SHEET_HALF * 2)) * NOISE_NZ));
  const iy = Math.floor(fy), iz = Math.floor(fz), ty = smooth(fy - iy), tz = smooth(fz - iz);
  const at = (a, b) => g[a * (NOISE_NZ + 1) + b];
  return (at(iy, iz) * (1 - tz) + at(iy, iz + 1) * tz) * (1 - ty) +
         (at(iy + 1, iz) * (1 - tz) + at(iy + 1, iz + 1) * tz) * ty;
}

// One game's sheet, generated from a seed. What changes it:
//   between games   base speed (mostly ~14.0s hog-to-hog, sometimes ~13.5 or
//                   ~15.0), how much it curls, which side swings more, and
//                   where the keen and heavy patches are
//   during a game   fresh pebble starts 0.6-0.9s slow and keens up over the
//                   first handful of stones; much later it breaks down and
//                   goes slower and straighter again
//   where you throw the outside edges are frosty, and every stone polishes
//                   the lane it travels, which gets quicker and straighter
// Call stoneThrown() after each delivery.
function makeLivingIce(seed) {
  const rng = makeRng(seed);
  const pick = rng();
  const baseHth = (pick < 0.6 ? 14.0 : pick < 0.8 ? 13.5 : 15.0) + (rng() - 0.5) * 0.3;
  const fresh = 0.6 + rng() * 0.3;
  const breakAt = 40 + Math.floor(rng() * 16);
  const curlFeet = 4.8 + (baseHth - 14) * 0.8 + (rng() - 0.5) * 0.8;
  const curl0 = curlForFeet(curlFeet, decelForHth(baseHth));
  const swingSide = (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.5);
  const speedPatches = noiseGrid(rng), curlPatches = noiseGrid(rng);
  const wear = new Float32Array(WEAR_NY * WEAR_NZ);
  let thrown = 0, decelNow = 0, curlNow = 0;

  function breakdown() { return Math.min(0.6, Math.max(0, thrown - breakAt) * 0.02); }
  function hthNow() { return baseHth - fresh * Math.exp(-thrown / 3.5) - breakdown(); }
  function refresh() {
    decelNow = decelForHth(hthNow());
    curlNow = curl0 * (1 - 0.25 * breakdown() / 0.6);
  }
  function wearCell(y, z) {
    const iy = Math.floor(y), iz = Math.floor((z + SHEET_HALF) / 0.25);
    return iy < 0 || iy >= WEAR_NY || iz < 0 || iz >= WEAR_NZ ? -1 : iy * WEAR_NZ + iz;
  }
  function wearAt(y, z) { const c = wearCell(y, z); return c < 0 ? 0 : wear[c]; }
  refresh();

  return {
    seed, baseHth, curlFeet, swingSide,
    get stonesThrown() { return thrown; },
    hthNow,
    decelAt(y, z) {
      const edge = Math.abs(z) / SHEET_HALF;
      return decelNow * (1 + 0.035 * noiseAt(speedPatches, y, z) + 0.07 * edge * edge * edge * edge)
                      * (1 - 0.045 * wearAt(y, z));
    },
    curlAt(y, z) {
      return curlNow * (1 + 0.22 * swingSide * (z / SHEET_HALF) + 0.08 * noiseAt(curlPatches, y, z))
                     * (1 - 0.12 * wearAt(y, z));
    },
    // a stone travelled `dist` metres here: ten passes polish a lane fully
    wearUnder(y, z, dist) {
      for (const [dz, k] of [[0, 0.1], [-0.25, 0.05], [0.25, 0.05]]) {
        const c = wearCell(y, z + dz);
        if (c >= 0) wear[c] = Math.min(1, wear[c] + dist * k);
      }
    },
    wearAt,
    // the sheet-wide speed and curl right now, before patches, edges and wear
    baseNow() { return { decel: decelNow, curl: curlNow }; },
    stoneThrown() { thrown++; refresh(); },
    // What the icemaker tells both teams before the game: rounded, and
    // silent about the fresh pebble, the patches and the swingy side.
    report() {
      const hth = Math.round(baseHth * 2) / 2, feet = Math.round(curlFeet * 2) / 2;
      return {
        hth, feet,
        speed: hth >= 14.5 ? 'QUICK' : hth <= 13.5 ? 'HEAVY' : 'NORMAL',
        swing: feet >= 5.5 ? 'SWINGY' : feet <= 4 ? 'STRAIGHT' : 'NORMAL',
      };
    },
  };
}

// ---------------------------------------------------------- seeded randomness
// mulberry32: small, fast, and reproducible from a 32-bit seed.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SHEET_HALF, WALL_Z, SLIDE_START, NBACK, NTEE, RELEASE_Y, NHOG, FHOG, TEE, BACK, WLEN,
    HOUSE_R, R, V_STOP, RESTITUTION, SWEEP_FRICTION, SWEEP_CURL, SPIN_RATE,
    ICE_DECEL, ICE_CURL, makeIce, makeLivingIce, decelForHth, hthForDecel, curlForFeet, iceSpeedOnLine, curlGate, isMoving, stepStone, stepWorld,
    simulateStone, releasedStone, simulateShot, solveAim, speedToStopAt, coastDistance,
    V_MIN, V_MAX, P_HOG, P_BACKX, V_HOG, V_BACK, vOfPower, powerOfV, makeRng,
  };
}
