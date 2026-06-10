'use strict';
/* ============================================================
   CURLING '94
   NES-style arcade curling with realistic stone physics.
   Vertical-scrolling rink (NHL '94), oscillating aim + power
   meters (Madden field goals), big splash screens & portraits
   (Punch-Out!! / Windjammers).
   ============================================================ */

// ---------------------------------------------------------- canvas
const W = 256, H = 240;
const cv = document.getElementById('game');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------------------------------------------------------- input
const keys = {}, pressed = {};
const GAME_KEYS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','KeyZ','KeyX'];
addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  if (!e.repeat) { keys[e.code] = 1; pressed[e.code] = 1; }
  audioInit();
});
addEventListener('keyup', e => { keys[e.code] = 0; });
function tap(c) { if (pressed[c]) { pressed[c] = 0; return true; } return false; }

// ---------------------------------------------------------- audio
let AC = null, slideNode = null, slideGain = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
}
function beep(f, d, type, vol, slideTo) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.value = f;
  if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, AC.currentTime + d);
  g.gain.value = vol || 0.08;
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d);
  o.connect(g); g.connect(AC.destination);
  o.start(); o.stop(AC.currentTime + d);
}
let noiseBuf = null;
function getNoise() {
  if (!AC) return null;
  if (!noiseBuf) {
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function noiseBurst(d, vol, freq, type) {
  if (!AC) return;
  const s = AC.createBufferSource(); s.buffer = getNoise(); s.loop = true;
  const f = AC.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 1200;
  const g = AC.createGain(); g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d);
  s.connect(f); f.connect(g); g.connect(AC.destination);
  s.start(); s.stop(AC.currentTime + d);
}
function slideStart() {
  if (!AC || slideNode) return;
  slideNode = AC.createBufferSource(); slideNode.buffer = getNoise(); slideNode.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  slideGain = AC.createGain(); slideGain.gain.value = 0;
  slideNode.connect(f); f.connect(slideGain); slideGain.connect(AC.destination);
  slideNode.start();
}
function slideLevel(v) { if (slideGain) slideGain.gain.value = Math.min(0.06, v); }
function slideStop() {
  if (slideNode) { try { slideNode.stop(); } catch (e) {} slideNode = null; slideGain = null; }
}
function sfxLock()   { beep(880, 0.07, 'square', 0.08); }
function sfxMove()   { beep(440, 0.05, 'square', 0.06); }
function sfxStart()  { beep(523, 0.09, 'square', 0.08); beep(784, 0.14, 'square', 0.08); }
function sfxSweep()  { noiseBurst(0.07, 0.07, 3200, 'highpass'); }
function sfxThud(v)  { beep(110, 0.1, 'triangle', Math.min(0.2, v * 0.07)); noiseBurst(0.08, Math.min(0.15, v * 0.05), 900); }
function sfxBoard()  { beep(70, 0.12, 'triangle', 0.14); noiseBurst(0.1, 0.1, 500); }
function sfxCheer()  { noiseBurst(1.4, 0.12, 800); noiseBurst(1.0, 0.08, 2000, 'highpass'); }
function sfxWhistle(){ beep(1568, 0.4, 'square', 0.05, 1245); }
function jingle(win) {
  const seq = win ? [523, 659, 784, 1047] : [392, 330, 262, 196];
  seq.forEach((f, i) => setTimeout(() => beep(f, 0.16, 'square', 0.09), i * 130));
}
// tiny title-screen sequencer
const MELODY = [262, 330, 392, 330, 294, 370, 440, 370, 262, 330, 392, 523, 440, 392, 330, 294];
let tuneT = 0, tuneI = 0;
function tickTune(dt) {
  tuneT -= dt;
  if (tuneT <= 0 && AC) {
    beep(MELODY[tuneI % MELODY.length], 0.12, 'square', 0.04);
    beep(MELODY[tuneI % MELODY.length] / 2, 0.22, 'triangle', 0.05);
    tuneI++; tuneT = 0.22;
  }
}

// ---------------------------------------------------------- 5x5 pixel font
const FONT = {};
(function () {
  const raw = {
    A:'01110 10001 11111 10001 10001', B:'11110 10001 11110 10001 11110',
    C:'01111 10000 10000 10000 01111', D:'11110 10001 10001 10001 11110',
    E:'11111 10000 11110 10000 11111', F:'11111 10000 11110 10000 10000',
    G:'01111 10000 10011 10001 01111', H:'10001 10001 11111 10001 10001',
    I:'11111 00100 00100 00100 11111', J:'00111 00010 00010 10010 01100',
    K:'10010 10100 11000 10100 10010', L:'10000 10000 10000 10000 11111',
    M:'10001 11011 10101 10001 10001', N:'10001 11001 10101 10011 10001',
    O:'01110 10001 10001 10001 01110', P:'11110 10001 11110 10000 10000',
    Q:'01110 10001 10101 10010 01101', R:'11110 10001 11110 10100 10010',
    S:'01111 10000 01110 00001 11110', T:'11111 00100 00100 00100 00100',
    U:'10001 10001 10001 10001 01110', V:'10001 10001 10001 01010 00100',
    W:'10001 10001 10101 11011 10001', X:'10001 01010 00100 01010 10001',
    Y:'10001 01010 00100 00100 00100', Z:'11111 00010 00100 01000 11111',
    0:'01110 10011 10101 11001 01110', 1:'00100 01100 00100 00100 01110',
    2:'11110 00001 01110 10000 11111', 3:'11110 00001 00110 00001 11110',
    4:'10010 10010 11111 00010 00010', 5:'11111 10000 11110 00001 11110',
    6:'01110 10000 11110 10001 01110', 7:'11111 00001 00010 00100 00100',
    8:'01110 10001 01110 10001 01110', 9:'01110 10001 01111 00001 01110',
    '!':'00100 00100 00100 00000 00100', '?':'01110 00001 00110 00000 00100',
    '.':'00000 00000 00000 00000 00100', ',':'00000 00000 00000 00100 01000',
    "'":'00100 00100 00000 00000 00000', '-':'00000 00000 01110 00000 00000',
    ':':'00000 00100 00000 00100 00000', '/':'00001 00010 00100 01000 10000',
    '(':'00010 00100 00100 00100 00010', ')':'01000 00100 00100 00100 01000',
    '>':'01000 00100 00010 00100 01000', '<':'00010 00100 01000 00100 00010',
  };
  for (const k in raw) FONT[k] = raw[k].split(' ');
})();
function textW(s, sc) { return s.length * 6 * (sc || 1) - (sc || 1); }
function drawText(s, x, y, col, sc, align) {
  sc = sc || 1;
  s = String(s).toUpperCase();
  if (align === 'center') x -= (textW(s, sc) / 2) | 0;
  if (align === 'right') x -= textW(s, sc);
  ctx.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]];
    if (g) for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++)
      if (g[r][c] === '1') ctx.fillRect(x + i * 6 * sc + c * sc, y + r * sc, sc, sc);
  }
}
function drawTextSh(s, x, y, col, shCol, sc, align) {
  drawText(s, x + sc, y + sc, shCol, sc, align);
  drawText(s, x, y, col, sc, align);
}

// ---------------------------------------------------------- pixel helpers
function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); }
function fillEllipse(cx, cy, rx, ry, c) {
  ctx.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    if (t < 0) continue;
    const dx = Math.floor(rx * Math.sqrt(t));
    ctx.fillRect((cx - dx) | 0, (cy + dy) | 0, dx * 2 + 1, 1);
  }
}
function drawSprite(rows, pal, x, y, sc) {
  sc = sc || 1;
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const col = pal[rows[r][c]];
      if (col) px(x + c * sc, y + r * sc, sc, sc, col);
    }
}
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

// ---------------------------------------------------------- sprites
const SPR_THROWER_STAND = [
  '....HHHH....',
  '...HHHHHH...',
  '....SSSS....',
  '...JJJJJJ...',
  '..JJJJJJJJ..',
  '..JDJJJJDJ..',
  '.SJJJJJJJJS.',
  '..JJJJJJJJ..',
  '...PPPPPP...',
  '...PP..PP...',
  '...PP..PP...',
  '...BB..BB...',
];
const SPR_THROWER_LUNGE = [
  '............',
  '....HHHH....',
  '...HHHHHH...',
  '....SSSS....',
  '..JJJJJJJS..',
  '.JJDJJJJJJS.',
  '.JJJJJJJJJ..',
  '..PPPPPPP...',
  '.PP....PPP..',
  'BB......BB..',
  '............',
  '............',
];
const SPR_SWEEP_A = [
  '...HHHH...',
  '...SSSS...',
  '..JJJJJJ..',
  '.SJJJJJJ..',
  'W.JJJJJJ..',
  'W..PPPP...',
  'W..P..P...',
  'WW.B..B...',
];
const SPR_SWEEP_B = [
  '...HHHH...',
  '...SSSS...',
  '..JJJJJJ..',
  '..JJJJJJS.',
  '..JJJJJJ.W',
  '...PPPP..W',
  '...P..P..W',
  '...B..B.WW',
];
const FACE_GUS = [
  '..RRRRRRRRRR..',
  '.RRRRWWRRRRRR.',
  '.RRRRRRRRRRRR.',
  '..SSSSSSSSSS..',
  '.SSSSSSSSSSSS.',
  '.SSKKSSSSKKSS.',
  '.SSKKSSSSKKSS.',
  '.SSSSSSSSSSSS.',
  '.SSSSSKKSSSSS.',
  '.SMMMMMMMMMMS.',
  '.SMMMMMMMMMMS.',
  '..SSSOOOOSSS..',
  '..SSSSSSSSSS..',
  '...SSSSSSSS...',
];
const FACE_HAMMER = [
  '..YYYYYYYYYY..',
  '.YYYYYYYYYYYY.',
  '.BBBBBBBBBBBB.',
  '.BBWWBBBBWWBB.',
  '.SSSSSSSSSSSS.',
  '.KKKKKKKKKKKK.',
  '.KKKKKSSKKKKK.',
  '.SSSSSSSSSSSS.',
  '.SSSSSKKSSSSS.',
  '.SSSSSSSSSSSS.',
  '.SSOOOOOOOOSS.',
  '.SSSOWWWWOSSS.',
  '..SSSOOOOSSS..',
  '...SSSSSSSS...',
];
const FACE_PAL_GUS = { R:'#d82800', W:'#fcfcfc', S:'#f8b888', K:'#000000', M:'#7c3000', O:'#a81000' };
const FACE_PAL_HAMMER = { Y:'#f8d878', B:'#0058f8', W:'#fcfcfc', S:'#f8b888', K:'#181818', O:'#a81000' };

// ---------------------------------------------------------- teams
const TEAMS = [
  { name:'MOOSE JAW',   short:'MJW', skip:'BIG GUS',    c1:'#d82800', c2:'#881400', face:FACE_GUS,    fpal:FACE_PAL_GUS,
    taunts:['DRAW TO THE BUTTON, EH!','CLEAN THE ICE, BOYS!','HURRY HARD OR GO HOME!'] },
  { name:'THUNDER BAY', short:'TBY', skip:'THE HAMMER', c1:'#0058f8', c2:'#00287c', face:FACE_HAMMER, fpal:FACE_PAL_HAMMER,
    taunts:['TIME TO BRING THE HAMMER!','YOUR ROCKS ARE TOAST!','I NEVER MISS, PAL!'] },
];

// ---------------------------------------------------------- world constants (meters)
const SHEET_HALF = 2.375;          // half sheet width
const WALL_Z = SHEET_HALF - 0.05;  // side boards
const RELEASE_Y = 1.5;             // stone release point
const NHOG = 10.0;                 // near hog line
const FHOG = 31.95;                // far hog line
const TEE = 38.35;                 // far tee (button)
const BACK = 40.18;                // back line
const WLEN = 41.6;                 // playable world length
const HOUSE_R = 1.83;              // 12-foot ring
const R = 0.25;                    // stone radius (chunky arcade granite)
const A0 = 0.092;                  // base ice deceleration m/s^2
const SX = 28, SY = 22;            // pixels per meter (NHL-style wide look)
const SHEET_PX = SHEET_HALF * 2 * SX;
const VMIN = 1.2, VMAX = 4.1;      // power meter velocity range
const VIEW_M = H / SY;

// ---- FEEL LAB (EXP-01): live-switchable tuning profiles, keys 1-4.
// ts: time scale | aimSpeed/aimRange: arrow oscillation | powerPeriod: meter cycle
// curlK: bend strength | sweepAdd/Decay: mash response | sweepFriction/Curl: sweep effect
const PROFILES = [
  { name:'CLASSIC', ts:2.4, aimSpeed:2.4, aimRange:4.2, powerPeriod:1.3,
    curlK:0.0068, sweepAdd:0.34, sweepDecay:1.1, sweepFriction:0.72, sweepCurl:0.30 },
  { name:'ARCADE',  ts:3.4, aimSpeed:3.2, aimRange:4.6, powerPeriod:0.95,
    curlK:0.0055, sweepAdd:0.40, sweepDecay:1.0, sweepFriction:0.65, sweepCurl:0.25 },
  { name:'SIM',     ts:1.7, aimSpeed:1.6, aimRange:3.6, powerPeriod:1.8,
    curlK:0.0095, sweepAdd:0.25, sweepDecay:0.9, sweepFriction:0.82, sweepCurl:0.40 },
  { name:'TWITCHY', ts:2.4, aimSpeed:4.6, aimRange:4.2, powerPeriod:0.75,
    curlK:0.0068, sweepAdd:0.28, sweepDecay:1.8, sweepFriction:0.70, sweepCurl:0.30 },
];
let tuneIdx = 0;
try { tuneIdx = Math.min(3, Math.max(0, +localStorage.getItem('c94feel') || 0)); } catch (e) {}
let TUNE = PROFILES[tuneIdx];

function curlG(v) { return Math.max(0.12, Math.min(1.55, 1.7 - 0.6 * v)); }
function vOfPower(p) { return VMIN + p * (VMAX - VMIN); }
function powerOfV(v) { return (v - VMIN) / (VMAX - VMIN); }
const V_DRAW = Math.sqrt(2 * A0 * (TEE - RELEASE_Y));            // stop on the button
const V_GUARD = Math.sqrt(2 * A0 * (FHOG + 2.5 - RELEASE_Y));    // stop between hog & house
const V_BACK = Math.sqrt(2 * A0 * (BACK - RELEASE_Y));           // stop at back line

// ---------------------------------------------------------- game state
const G = {
  state: 'title', t: 0, st: 0,        // global time, state time
  mode: 1, rocksPer: 4, endsTotal: 2, // menu options
  menuSel: 0,
  end: 1, hammer: 1, scores: [0, 0],
  throwIdx: 0, stones: [], active: null,
  team: 0, cpuTurn: false, cpu: null,
  aimAng: 0, spin: 1, power: 0, vRelease: 0,
  sweep: 0, sweepTaps: 0,
  cam: -2, camTarget: -2,
  flash: null, banner: '', taunt: '',
  endPoints: 0, endWinner: -1, gameWinner: -1,
  extraEnd: false,
  events: { contact: false, takeouts: 0, hogged: false, out: false },
};
function setFlash(txt, col, dur) { G.flash = { txt, col, t: dur || 1.2 }; }
function setState(s) { G.state = s; G.st = 0; }
function humanTurn() { return !(G.mode === 1 && G.team === 1); }
function throwTeam(idx) {
  const first = 1 - G.hammer;
  return idx % 2 === 0 ? first : G.hammer;
}

// ---------------------------------------------------------- physics
function moving(s) { return Math.hypot(s.vy, s.vz) > 0.04; }
function anyMoving() { return G.stones.some(s => s.alive && moving(s)); }

function stepPhysics(rdt) {
  const SUB = 4, dt = (rdt * TUNE.ts) / SUB;
  for (let k = 0; k < SUB; k++) {
    for (const s of G.stones) {
      if (!s.alive) continue;
      const sp = Math.hypot(s.vy, s.vz);
      if (sp < 0.04) { s.vy = 0; s.vz = 0; continue; }
      const sweep = (s === G.active) ? G.sweep : 0;
      const a = A0 * (1 - (1 - TUNE.sweepFriction) * sweep);
      const uy = s.vy / sp, uz = s.vz / sp;
      // friction opposing motion
      s.vy -= a * uy * dt; s.vz -= a * uz * dt;
      // curl: lateral accel perpendicular to velocity, grows as stone slows
      const cl = TUNE.curlK * s.spin * curlG(sp) * (1 - (1 - TUNE.sweepCurl) * sweep);
      s.vy += -uz * cl * dt; s.vz += uy * cl * dt;
      s.y += s.vy * dt; s.z += s.vz * dt;
      s.rot += s.spin * Math.max(0.6, sp) * 1.6 * dt;
      // side boards
      if (Math.abs(s.z) + R > WALL_Z && s.alive) {
        s.alive = false; s.vy = s.vz = 0; G.events.out = true;
        sfxBoard(); if (s === G.active) setFlash('OFF THE BOARDS!', '#f87858', 1.4);
      }
      // through the back line
      if (s.y - R > BACK && s.alive) {
        s.alive = false; s.vy = s.vz = 0; G.events.out = true;
        if (s === G.active) setFlash('TOO HEAVY!', '#f87858', 1.4);
        else { G.events.takeouts++; if (s.team !== G.active.team) setFlash('TAKEOUT!!', '#f8d878', 1.4); }
      }
    }
    // stone-stone collisions (equal mass, mostly-elastic granite)
    for (let i = 0; i < G.stones.length; i++) {
      const a = G.stones[i]; if (!a.alive) continue;
      for (let j = i + 1; j < G.stones.length; j++) {
        const b = G.stones[j]; if (!b.alive) continue;
        const dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.hypot(dy, dz);
        if (d > 0 && d < R * 2) {
          const ny = dy / d, nz = dz / d, overlap = R * 2 - d;
          a.y -= ny * overlap / 2; a.z -= nz * overlap / 2;
          b.y += ny * overlap / 2; b.z += nz * overlap / 2;
          const van = a.vy * ny + a.vz * nz, vbn = b.vy * ny + b.vz * nz;
          if (van - vbn > 0) {
            const e = 0.92, ja = ((1 + e) / 2) * (van - vbn);
            a.vy -= ja * ny; a.vz -= ja * nz;
            b.vy += ja * ny; b.vz += ja * nz;
            a.touched = b.touched = true;
            if (!G.events.contact) { G.events.contact = true; }
            sfxThud(van - vbn);
          }
        }
      }
    }
  }
}

// offline trajectory sim (AI planning + minimap projection). No collisions.
function simShot(v, ang, spin, stopAtY) {
  let y = RELEASE_Y, z = 0, vy = v * Math.cos(ang), vz = v * Math.sin(ang);
  const dt = 0.06, pts = [{ y, z }];
  for (let i = 0; i < 12000; i++) {
    const sp = Math.hypot(vy, vz);
    if (sp < 0.04) break;
    const uy = vy / sp, uz = vz / sp;
    vy -= A0 * uy * dt; vz -= A0 * uz * dt;
    const cl = TUNE.curlK * spin * curlG(sp);
    vy += -uz * cl * dt; vz += uy * cl * dt;
    y += vy * dt; z += vz * dt;
    if (i % 8 === 0) pts.push({ y, z });
    if (stopAtY !== undefined && y >= stopAtY) break;
    if (Math.abs(z) + R > WALL_Z || y - R > BACK) break;
  }
  pts.push({ y, z });
  return { y, z, pts };
}
// solve aim angle so the shot arrives at (ty,tz)
function solveAim(v, spin, ty, tz) {
  let ang = Math.atan2(tz, ty - RELEASE_Y);
  for (let i = 0; i < 4; i++) {
    const r = simShot(v, ang, spin, ty);
    ang -= Math.atan2(r.z - tz, ty - RELEASE_Y);
  }
  return ang;
}

// ---------------------------------------------------------- scoring & flow
function houseDist(s) { return Math.hypot(s.y - TEE, s.z); }
function inHouse(s) { return s.alive && houseDist(s) <= HOUSE_R + R; }
function shotStone() {
  let best = null;
  for (const s of G.stones) if (inHouse(s) && (!best || houseDist(s) < houseDist(best))) best = s;
  return best;
}
function evalEnd() {
  const ds = [[], []];
  for (const s of G.stones) if (inHouse(s)) ds[s.team].push(houseDist(s));
  ds[0].sort((a, b) => a - b); ds[1].sort((a, b) => a - b);
  if (!ds[0].length && !ds[1].length) return { winner: -1, pts: 0 };
  let winner;
  if (!ds[0].length) winner = 1;
  else if (!ds[1].length) winner = 0;
  else winner = ds[0][0] < ds[1][0] ? 0 : 1;
  const oppBest = ds[1 - winner].length ? ds[1 - winner][0] : Infinity;
  return { winner, pts: ds[winner].filter(d => d < oppBest).length };
}
function resetGame() {
  G.scores = [0, 0]; G.end = 1; G.hammer = 1; G.extraEnd = false;
  G.gameWinner = -1;
  startEnd();
}
function startEnd() {
  G.stones = []; G.throwIdx = 0; G.active = null;
  nextThrow();
}
function nextThrow() {
  G.team = throwTeam(G.throwIdx);
  G.cpuTurn = (G.mode === 1 && G.team === 1);
  G.aimAng = 0; G.spin = 1; G.power = 0; G.sweep = 0;
  G.events = { contact: false, takeouts: 0, hogged: false, out: false };
  G.cpu = G.cpuTurn ? planCpu() : null;
  const T = TEAMS[G.team];
  G.taunt = T.taunts[(Math.random() * T.taunts.length) | 0];
  G.banner = `${T.name} - STONE ${(G.throwIdx >> 1) + 1} OF ${G.rocksPer}`;
  setState('prethrow');
}

// ---------------------------------------------------------- CPU brain
function planCpu() {
  const me = G.team, opp = 1 - me;
  const shot = shotStone();
  const lastStone = (G.throwIdx >> 1) + 1 >= G.rocksPer;
  let plan;
  if (shot && shot.team === opp) {
    // opponent sitting shot: peel it out
    const v = 3.3 + Math.random() * 0.4;
    const spin = shot.z > 0 ? -1 : 1;
    const ang = solveAim(v, spin, shot.y, shot.z);
    plan = { kind: 'takeout', v, ang, spin, stopY: null, targetY: shot.y };
  } else if (shot && shot.team === me && !lastStone && Math.random() < 0.5) {
    // protect with a centre guard
    const stopY = FHOG + 1.5 + Math.random() * 2.5;
    const v = Math.sqrt(2 * A0 * (stopY - RELEASE_Y));
    const spin = Math.random() < 0.5 ? 1 : -1;
    const ang = solveAim(v, spin, stopY, shot.z * 0.6);
    plan = { kind: 'guard', v, ang, spin, stopY };
  } else {
    // draw to the button (or to an open side)
    const tz = (Math.random() - 0.5) * 0.7;
    const v = Math.sqrt(2 * A0 * (TEE - RELEASE_Y));
    const spin = tz > 0 ? -1 : 1;
    const ang = solveAim(v, spin, TEE, tz);
    plan = { kind: 'draw', v, ang, spin, stopY: TEE };
  }
  // CPU is good, not perfect
  plan.v *= 1 + (Math.random() - 0.5) * 0.05;
  plan.ang += (Math.random() - 0.5) * 0.008;
  plan.p = Math.max(0.05, Math.min(0.98, powerOfV(plan.v)));
  return plan;
}
function cpuSweepLogic() {
  const s = G.active;
  if (!s || !s.alive || !moving(s)) { G.sweep = Math.max(0, G.sweep - 0.05); return; }
  const p = G.cpu;
  if (!p || !p.stopY) { G.sweep = 0; return; }
  const sp = Math.hypot(s.vy, s.vz);
  const projStop = s.y + (sp * sp) / (2 * A0);
  G.sweep = projStop < p.stopY - 0.25 ? Math.min(1, G.sweep + 0.1) : Math.max(0, G.sweep - 0.1);
}

// ---------------------------------------------------------- update
function update(dt) {
  G.t += dt; G.st += dt;
  // FEEL LAB: hot-swap tuning profile any time
  for (let i = 0; i < PROFILES.length; i++) {
    if (tap('Digit' + (i + 1))) {
      tuneIdx = i; TUNE = PROFILES[i];
      try { localStorage.setItem('c94feel', i); } catch (e) {}
      setFlash('FEEL ' + (i + 1) + ': ' + TUNE.name, '#f8d878', 1.0);
      sfxMove();
    }
  }
  if (G.flash) { G.flash.t -= dt; if (G.flash.t <= 0) G.flash = null; }
  // camera easing
  G.cam += (G.camTarget - G.cam) * Math.min(1, dt * 5);

  switch (G.state) {
    case 'title': {
      tickTune(dt);
      if (tap('Enter') || tap('Space')) { sfxStart(); setState('menu'); }
      break;
    }
    case 'menu': {
      tickTune(dt);
      const N = 4;
      if (tap('ArrowUp'))   { G.menuSel = (G.menuSel + N - 1) % N; sfxMove(); }
      if (tap('ArrowDown')) { G.menuSel = (G.menuSel + 1) % N; sfxMove(); }
      const dir = tap('ArrowRight') ? 1 : tap('ArrowLeft') ? -1 : 0;
      if (dir) {
        sfxMove();
        if (G.menuSel === 0) G.mode = G.mode === 1 ? 2 : 1;
        if (G.menuSel === 1) { const o = [2, 4, 8], i = o.indexOf(G.rocksPer); G.rocksPer = o[(i + dir + 3) % 3]; }
        if (G.menuSel === 2) { const o = [1, 2, 4], i = o.indexOf(G.endsTotal); G.endsTotal = o[(i + dir + 3) % 3]; }
      }
      const go = tap('Enter') || (tap('Space') && G.menuSel === 3);
      if (go) { sfxStart(); resetGame(); }
      break;
    }
    case 'prethrow': {
      G.camTarget = -2;
      if (G.st > 1.6 || tap('Space') || tap('Enter')) setState('curl');
      break;
    }
    case 'curl': {
      G.camTarget = -2;
      if (G.cpuTurn) {
        G.spin = G.cpu.spin;
        if (G.st > 0.6) { sfxLock(); setState('aim'); }
      } else {
        if (tap('ArrowLeft'))  { G.spin = -1; sfxMove(); }
        if (tap('ArrowRight')) { G.spin = 1; sfxMove(); }
        if (tap('Space') || tap('Enter')) { sfxLock(); setState('aim'); }
      }
      break;
    }
    case 'aim': {
      G.camTarget = -2;
      if (G.cpuTurn) {
        // glide the arrow toward the planned angle, then lock
        G.aimAng += (G.cpu.ang - G.aimAng) * Math.min(1, dt * 4);
        if (G.st > 1.1) { G.aimAng = G.cpu.ang; G.power = 0; sfxLock(); setState('power'); }
      } else {
        G.aimAng = Math.sin(G.st * TUNE.aimSpeed) * (TUNE.aimRange * Math.PI / 180);
        if (tap('Space') || tap('Enter')) { G.power = 0; sfxLock(); setState('power'); }
      }
      break;
    }
    case 'power': {
      if (G.cpuTurn) {
        G.power = Math.min(G.cpu.p, G.st / TUNE.powerPeriod);
        if (G.power >= G.cpu.p) { G.vRelease = vOfPower(G.power); sfxLock(); startDelivery(); }
      } else {
        const ph = (G.st / TUNE.powerPeriod) % 1;
        G.power = ph < 0.5 ? ph * 2 : 2 - ph * 2;
        if (tap('Space') || tap('Enter')) { G.vRelease = vOfPower(G.power); sfxLock(); startDelivery(); }
      }
      break;
    }
    case 'deliver': {
      G.camTarget = -2;
      if (G.st > 0.55) {
        const s = {
          team: G.team, y: RELEASE_Y, z: 0,
          vy: G.vRelease * Math.cos(G.aimAng),
          vz: G.vRelease * Math.sin(G.aimAng),
          spin: G.spin, rot: 0, alive: true, touched: false,
        };
        G.stones.push(s); G.active = s;
        noiseBurst(0.3, 0.08, 700);
        slideStart();
        setState('slide');
      }
      break;
    }
    case 'slide': {
      // sweeping input
      if (G.cpuTurn) cpuSweepLogic();
      else {
        if (tap('Space') || tap('KeyZ') || tap('KeyX') || tap('ArrowLeft') || tap('ArrowRight')) {
          G.sweep = Math.min(1, G.sweep + TUNE.sweepAdd); sfxSweep();
        }
        G.sweep = Math.max(0, G.sweep - dt * TUNE.sweepDecay);
      }
      stepPhysics(dt);
      const s = G.active;
      if (s && s.alive) {
        G.camTarget = Math.max(-2, Math.min(s.y - 3.5, WLEN - VIEW_M + 0.4));
        slideLevel(0.012 + Math.hypot(s.vy, s.vz) * 0.012 + G.sweep * 0.02);
      } else {
        G.camTarget = TEE - VIEW_M / 2;
        slideLevel(anyMoving() ? 0.02 : 0);
      }
      if (!anyMoving() || G.st > 40) {
        slideStop();
        finishThrow();
      }
      break;
    }
    case 'postthrow': {
      G.camTarget = TEE - VIEW_M / 2 - 1.2;
      if (G.st > 1.6) {
        G.throwIdx++;
        if (G.throwIdx >= G.rocksPer * 2) {
          const r = evalEnd();
          G.endWinner = r.winner; G.endPoints = r.pts;
          if (r.winner >= 0) { G.scores[r.winner] += r.pts; G.hammer = 1 - r.winner; sfxCheer(); jingle(true); }
          else sfxWhistle();
          setState('endscore');
        } else nextThrow();
      }
      break;
    }
    case 'endscore': {
      if (G.st > 3.2 || tap('Enter') || tap('Space')) {
        const last = G.end >= G.endsTotal;
        if (last && G.scores[0] !== G.scores[1]) {
          G.gameWinner = G.scores[0] > G.scores[1] ? 0 : 1;
          sfxCheer(); jingle(G.gameWinner === 0);
          setState('gameover');
        } else {
          if (last) { G.extraEnd = true; setFlash('EXTRA END!!', '#f8d878', 1.6); }
          G.end++; startEnd();
        }
      }
      break;
    }
    case 'gameover': {
      tickTune(dt);
      if (G.st > 1 && (tap('Enter') || tap('Space'))) { sfxStart(); setState('title'); }
      break;
    }
  }
  for (const k in pressed) pressed[k] = 0;
}

function startDelivery() { setState('deliver'); }

function finishThrow() {
  const s = G.active;
  if (s && s.alive && !s.touched && s.y - R < FHOG) {
    s.alive = false; G.events.hogged = true;
    setFlash('HOG LINE!!', '#f87858', 1.5);
    sfxWhistle();
  } else if (s && s.alive && !G.flash) {
    const d = houseDist(s);
    if (d < 0.45) { setFlash('RIGHT ON THE BUTTON!!', '#f8d878', 1.7); sfxCheer(); }
    else if (inHouse(s)) setFlash("SHOT'S IN!", '#80d010', 1.3);
    else if (s.y > FHOG && s.y < TEE - HOUSE_R) setFlash('GUARD UP!', '#3cbcfc', 1.2);
  }
  G.sweep = 0;
  setState('postthrow');
}

// ---------------------------------------------------------- rendering
function sxOf(z) { return (W / 2 + z * SX) | 0; }
function syOf(y) { return (H - (y - G.cam) * SY) | 0; }

function drawRink() {
  // ice
  px(0, 0, W, H, '#000000');
  const left = sxOf(-SHEET_HALF), right = sxOf(SHEET_HALF);
  px(left, 0, right - left, H, '#e4f0f8');
  // pebble speckle (stable per world position)
  ctx.fillStyle = '#c8dce8';
  const camPix = Math.floor(G.cam * SY);
  for (let yy = 0; yy < H; yy += 3) {
    const wy = yy + camPix - (camPix % 3);
    for (let xx = left; xx < right; xx += 7) {
      if (hash2(xx, wy, 7) < 0.3) ctx.fillRect(xx + ((wy * 13) % 5), H - (wy - camPix) , 1, 1);
    }
  }
  // centre line
  px(W / 2, 0, 1, H, '#a8c4d4');
  // house (far end)
  const hy = syOf(TEE);
  if (hy > -90 && hy < H + 90) {
    fillEllipse(W / 2, hy, (HOUSE_R * SX) | 0, (HOUSE_R * SY) | 0, '#3cbcfc');
    fillEllipse(W / 2, hy, (1.22 * SX) | 0, (1.22 * SY) | 0, '#fcfcfc');
    fillEllipse(W / 2, hy, (0.61 * SX) | 0, (0.61 * SY) | 0, '#d82800');
    fillEllipse(W / 2, hy, (0.15 * SX) | 0, (0.15 * SY) | 0, '#fcfcfc');
  }
  // lines: near hog, far hog, tee, back
  const lines = [
    [NHOG, '#d82800', 2], [FHOG, '#d82800', 2],
    [TEE, '#607080', 1], [BACK, '#000000', 1], [0.4, '#607080', 1],
  ];
  for (const [ly, col, th] of lines) {
    const yy = syOf(ly);
    if (yy >= -2 && yy <= H + 2) px(left, yy, right - left, th, col);
  }
  // hacks at near end
  const hackY = syOf(0);
  if (hackY > -8 && hackY < H + 8) {
    px(W / 2 - 6, hackY - 2, 4, 4, '#181818');
    px(W / 2 + 2, hackY - 2, 4, 4, '#181818');
  }
  // boards + ads
  drawBoards(left, right);
  drawCrowd(left, right);
}

const AD_COLORS = ['#d82800', '#0058f8', '#f8b800', '#00a800', '#fcfcfc'];
function drawBoards(left, right) {
  px(left - 4, 0, 4, H, '#fcfcfc');
  px(right, 0, 4, H, '#fcfcfc');
  const camPix = Math.floor(G.cam * SY);
  for (let yy = -24; yy < H + 24; yy += 24) {
    const wy = Math.floor((yy + camPix) / 24);
    const c = AD_COLORS[((wy % AD_COLORS.length) + AD_COLORS.length) % AD_COLORS.length];
    const sy = yy - (camPix % 24);
    px(left - 4, sy, 4, 12, c);
    px(right, sy + 12, 4, 12, c);
  }
  px(left - 1, 0, 1, H, '#b0b0b0');
  px(right, 0, 1, H, '#b0b0b0');
}
const CROWD_PAL = ['#f8b888', '#d82800', '#0058f8', '#f8b800', '#00a800', '#fcfcfc', '#7c7c7c', '#a04000'];
function drawCrowd(left, right) {
  const frame = Math.floor(G.t * 2.5);
  for (const [x0, x1] of [[0, left - 4], [right + 4, W]]) {
    px(x0, 0, x1 - x0, H, '#201808');
    for (let yy = 1; yy < H; yy += 5) {
      if (yy % 30 < 5) { px(x0, yy + 2, x1 - x0, 1, '#000000'); continue; } // aisle
      for (let xx = x0 + 1; xx < x1 - 2; xx += 4) {
        const h = hash2(xx, yy, 3);
        if (h < 0.62) {
          const bounce = hash2(xx, yy, frame) < 0.12 ? -1 : 0;
          px(xx, yy + bounce, 2, 2, CROWD_PAL[(h * 64 | 0) % CROWD_PAL.length]);
        }
      }
    }
  }
}

function drawStone(s) {
  const x = sxOf(s.z), y = syOf(s.y);
  if (y < -10 || y > H + 10) return;
  const T = TEAMS[s.team];
  fillEllipse(x, y + 2, 6, 4, 'rgba(40,60,80,0.5)'); // shadow
  fillEllipse(x, y, 6, 5, '#7c7c7c');                 // granite
  fillEllipse(x, y - 1, 5, 4, '#a4a4a4');
  fillEllipse(x, y - 1, 3, 2, T.c1);                  // handle cap
  // rotating handle tick
  const hx = Math.cos(s.rot) * 4, hy = Math.sin(s.rot) * 3;
  px(x + hx - 1, y - 1 + hy, 2, 2, T.c2);
}

function drawThrower(frame) {
  const T = TEAMS[G.team];
  const pal = { H: T.c2, S: '#f8b888', J: T.c1, D: T.c2, P: '#404040', B: '#181818' };
  const y = syOf(0) - 24;
  drawSprite(frame ? SPR_THROWER_LUNGE : SPR_THROWER_STAND, pal, W / 2 - 12, y, 2);
}
function drawSweepers() {
  const s = G.active;
  if (!s || !s.alive || G.sweep < 0.04) return;
  const T = TEAMS[s.team];
  const pal = { H: T.c2, S: '#f8b888', J: T.c1, P: '#404040', B: '#181818', W: '#c89858' };
  const fr = Math.floor(G.t * 12) % 2;
  const x = sxOf(s.z), y = syOf(s.y);
  drawSprite(fr ? SPR_SWEEP_A : SPR_SWEEP_B, pal, x - 24, y - 16, 2);
  drawSprite(fr ? SPR_SWEEP_B : SPR_SWEEP_A, pal, x + 6, y - 16, 2);
  // scrub marks
  if (fr) { px(x - 6, y - 9, 12, 1, '#fcfcfc'); px(x - 4, y - 12, 8, 1, '#fcfcfc'); }
}

function drawHud() {
  px(0, 0, W, 21, '#00287c');
  px(0, 21, W, 1, '#fcfcfc');
  for (let t = 0; t < 2; t++) {
    const T = TEAMS[t], x = t === 0 ? 4 : W - 4;
    const al = t === 0 ? 'left' : 'right';
    px(t === 0 ? 2 : W - 50, 2, 48, 17, T.c2);
    drawText(T.short, t === 0 ? 5 : W - 47, 4, '#fcfcfc', 1, 'left');
    drawText(String(G.scores[t]), t === 0 ? 40 : W - 12, 4, '#f8d878', 1, 'left');
    // stones remaining
    let remain = G.rocksPer - ((G.throwIdx + (throwTeam(G.throwIdx) === t ? 0 : 1)) >> 1);
    remain = Math.max(0, Math.min(G.rocksPer, remain));
    for (let i = 0; i < remain; i++) px((t === 0 ? 5 : W - 47) + i * 5, 13, 3, 3, T.c1);
    if (G.hammer === t) drawText('H', t === 0 ? 44 : W - 8, 13, '#f8d878');
  }
  const endTxt = G.extraEnd ? 'XTRA' : `END ${G.end}/${G.endsTotal}`;
  drawText(endTxt, W / 2, 4, '#fcfcfc', 1, 'center');
  const T = TEAMS[G.team];
  if (['prethrow','aim','curl','power','deliver','slide'].includes(G.state))
    drawText(G.cpuTurn ? 'CPU' : (G.mode === 2 ? `P${G.team + 1}` : 'P1'), W / 2, 13, T.c1, 1, 'center');
}

function drawMinimap(showPath) {
  const mx = 243, my = 28, mw = 10, mh = 198;
  const m2y = wy => my + mh - (wy / WLEN) * mh;
  px(mx - 1, my - 1, mw + 2, mh + 2, '#fcfcfc');
  px(mx, my, mw, mh, '#9cc4dc');
  px(mx, m2y(NHOG), mw, 1, '#d82800');
  px(mx, m2y(FHOG), mw, 1, '#d82800');
  px(mx, m2y(BACK), mw, 1, '#404040');
  fillEllipse(mx + mw / 2, m2y(TEE), 4, 4, '#3cbcfc');
  fillEllipse(mx + mw / 2, m2y(TEE), 2, 2, '#d82800');
  if (showPath) {
    const v = G.state === 'power' ? vOfPower(G.power) : V_DRAW;
    const r = simShot(v, G.aimAng, G.spin);
    ctx.fillStyle = '#f8d878';
    for (let i = 0; i < r.pts.length; i += 2) {
      const p = r.pts[i];
      ctx.fillRect(mx + mw / 2 + p.z * (mw / (SHEET_HALF * 2)) * 0.9, m2y(p.y), 1, 1);
    }
    px(mx + mw / 2 + r.z * (mw / (SHEET_HALF * 2)) * 0.9 - 1, m2y(r.y) - 1, 3, 3, '#f87800');
  }
  for (const s of G.stones) {
    if (!s.alive) continue;
    px(mx + mw / 2 + s.z * (mw / (SHEET_HALF * 2)) * 0.9 - 1, m2y(s.y) - 1, 2, 2, TEAMS[s.team].c1);
  }
  // camera window
  const cy0 = m2y(G.cam + VIEW_M), cy1 = m2y(G.cam);
  px(mx - 1, cy0, 1, Math.max(1, cy1 - cy0), '#f8d878');
}

function drawAimArrow() {
  const x0 = sxOf(0), y0 = syOf(RELEASE_Y);
  for (let d = 0.7; d < 5.9; d += 0.28) {
    if (Math.floor(d / 0.56) % 2) continue;
    const yy = RELEASE_Y + Math.cos(G.aimAng) * d;
    const zz = Math.sin(G.aimAng) * d;
    px(sxOf(zz) - 1, syOf(yy) - 1, 3, 3, '#f87800');
  }
  // arrowhead
  const zz = Math.sin(G.aimAng) * 6.3, yy = RELEASE_Y + Math.cos(G.aimAng) * 6.3;
  const ax = sxOf(zz), ay = syOf(yy);
  px(ax - 1, ay - 5, 3, 2, '#d82800');
  px(ax - 3, ay - 3, 7, 2, '#d82800');
  px(ax - 5, ay - 1, 11, 3, '#d82800');
  // ghost stone at release
  fillEllipse(x0, y0, 6, 5, 'rgba(124,124,124,0.7)');
}

function drawPowerMeter() {
  const mx = 10, my = 56, mw = 12, mh = 150;
  px(mx - 4, my - 10, mw + 32, mh + 22, '#00287c');
  px(mx - 1, my - 1, mw + 2, mh + 2, '#fcfcfc');
  px(mx, my, mw, mh, '#181818');
  const yOfV = v => my + mh - powerOfV(v) * mh;
  // zones
  px(mx, yOfV(V_BACK), mw, Math.max(2, yOfV(V_GUARD) - yOfV(V_BACK)), '#00a800'); // house weight
  px(mx, yOfV(V_GUARD), mw, Math.max(2, yOfV(VMIN + 0.9) - yOfV(V_GUARD)), '#f8b800'); // guard
  px(mx, my, mw, Math.max(2, yOfV(V_BACK) - my), '#d82800'); // takeout
  // draw-weight tick
  px(mx - 2, yOfV(V_DRAW), mw + 4, 1, '#fcfcfc');
  // fill level
  const lvl = G.power * mh;
  px(mx + 3, my + mh - lvl, mw - 6, lvl, '#fcfcfc');
  px(mx - 2, my + mh - lvl - 1, mw + 4, 2, '#f87800');
  drawText('PWR', mx + mw / 2, my - 8, '#fcfcfc', 1, 'center');
  drawText('HIT', mx + mw + 3, yOfV(V_BACK + 0.5) | 0, '#f87858');
  drawText('DRW', mx + mw + 3, yOfV(V_DRAW) - 2 | 0, '#80d010');
  drawText('GRD', mx + mw + 3, yOfV(V_GUARD + 0.05) | 0, '#f8d878');
}

function drawSweepGauge() {
  if (G.state !== 'slide') return;
  const mx = 10, my = 90, mw = 12, mh = 80;
  px(mx - 4, my - 4, mw + 8, mh + 20, '#00287c');
  px(mx - 1, my - 1, mw + 2, mh + 2, '#fcfcfc');
  px(mx, my, mw, mh, '#181818');
  const lvl = G.sweep * mh;
  const col = G.sweep > 0.66 ? '#d82800' : G.sweep > 0.33 ? '#f8b800' : '#3cbcfc';
  px(mx + 1, my + mh - lvl, mw - 2, lvl, col);
  drawText('SWP', mx + mw / 2, my + mh + 5, '#fcfcfc', 1, 'center');
  if (G.active && moving(G.active) && !G.cpuTurn) {
    if (Math.floor(G.t * 4) % 2) drawText(G.sweep > 0.6 ? 'HURRY HARD!!' : 'MASH SPACE!', W / 2, 200, '#f8d878', 1, 'center');
  }
}

function drawFlash() {
  if (!G.flash) return;
  if (Math.floor(G.t * 8) % 3 === 2) return;
  const f = G.flash;
  drawTextSh(f.txt, W / 2, 100, f.col, '#000000', 2, 'center');
}

function drawFace(team, x, y, sc) {
  const T = TEAMS[team];
  px(x - 2, y - 2, 14 * sc + 4, 14 * sc + 4, '#fcfcfc');
  px(x - 1, y - 1, 14 * sc + 2, 14 * sc + 2, '#181818');
  drawSprite(T.face, T.fpal, x, y, sc);
}

// ---- screens
function stripes(c1, c2, speed) {
  px(0, 0, W, H, c1);
  ctx.fillStyle = c2;
  const off = Math.floor(G.t * (speed || 30)) % 32;
  for (let x = -64; x < W + 64; x += 32)
    for (let y = 0; y < H; y++) ctx.fillRect(x + off - y / 2, y, 16, 1);
}
function drawTitle() {
  stripes('#0058f8', '#3cbcfc', 40);
  px(0, 44, W, 100, '#00287c');
  px(0, 44, W, 2, '#fcfcfc'); px(0, 142, W, 2, '#fcfcfc');
  drawTextSh('CURLING', W / 2, 54, '#fcfcfc', '#d82800', 4, 'center');
  drawTextSh("'94", W / 2, 90, '#f8d878', '#d82800', 5, 'center');
  if (Math.floor(G.t * 2) % 2) drawTextSh('PRESS ENTER', W / 2, 124, '#fcfcfc', '#000000', 1, 'center');
  drawFace(0, 28, 152, 3);
  drawFace(1, W - 28 - 46, 152, 3);
  // big stone between the rivals
  fillEllipse(W / 2, 178, 22, 9, '#7c7c7c');
  fillEllipse(W / 2, 174, 20, 8, '#a4a4a4');
  fillEllipse(W / 2, 172, 11, 4, '#d82800');
  px(W / 2 - 2, 166, 4, 5, '#881400');
  drawTextSh('HURRY HARD EDITION', W / 2, 206, '#f8d878', '#000000', 1, 'center');
  drawText('(C) 1994 GRANITE GAMES', W / 2, 224, '#9cc4dc', 1, 'center');
  drawText('FEEL LAB: KEYS 1-4', W / 2, 214, '#3cbcfc', 1, 'center');
}
function drawMenu() {
  stripes('#881400', '#d82800', 25);
  px(24, 30, W - 48, 180, '#00287c');
  px(24, 30, W - 48, 2, '#fcfcfc'); px(24, 208, W - 48, 2, '#fcfcfc');
  drawTextSh('GAME SETUP', W / 2, 42, '#f8d878', '#000000', 2, 'center');
  const rows = [
    ['MODE', G.mode === 1 ? 'VS CPU' : '2 PLAYER'],
    ['STONES', `${G.rocksPer} EACH`],
    ['ENDS', String(G.endsTotal)],
    ['START!', ''],
  ];
  for (let i = 0; i < rows.length; i++) {
    const y = 78 + i * 26;
    const sel = G.menuSel === i;
    if (sel) {
      px(34, y - 4, W - 68, 14, '#d82800');
      drawText('>', 40, y, '#f8d878');
    }
    drawText(rows[i][0], 52, y, sel ? '#fcfcfc' : '#9cc4dc');
    drawText(rows[i][1], W - 44, y, sel ? '#f8d878' : '#9cc4dc', 1, 'right');
  }
  drawText('ARROWS: CHANGE  ENTER: GO', W / 2, 190, '#fcfcfc', 1, 'center');
}
function drawPrethrow() {
  drawRink(); drawStones(); drawThrower(0); drawHud(); drawMinimap(false);
  const T = TEAMS[G.team];
  px(16, 88, W - 32, 64, '#00287c');
  px(16, 88, W - 32, 2, T.c1); px(16, 150, W - 32, 2, T.c1);
  drawFace(G.team, 26, 96, 3);
  drawTextSh(T.skip, 80, 100, '#f8d878', '#000000', 1);
  drawText(G.banner.split(' - ')[1] || '', 80, 112, '#fcfcfc');
  drawText(`'${G.taunt}'`, 80, 128, '#9cc4dc');
  if (Math.floor(G.t * 3) % 2) drawText('SPACE TO THROW', 80, 140, '#f8d878');
}
function drawStones() { for (const s of G.stones) if (s.alive) drawStone(s); }
function drawGame() {
  drawRink();
  drawStones();
  if (['aim', 'curl', 'power'].includes(G.state)) {
    drawThrower(0);
    drawAimArrow();
  }
  if (G.state === 'deliver') drawThrower(1);
  if (G.state === 'slide') drawSweepers();
  drawHud();
  drawMinimap(['aim', 'curl', 'power'].includes(G.state));
  if (G.state === 'power') drawPowerMeter();
  drawSweepGauge();
  if (G.state === 'aim' && !G.cpuTurn)
    drawText('SPACE: LOCK AIM', W / 2, 228, '#fcfcfc', 1, 'center');
  if (G.state === 'curl') {
    px(W / 2 - 58, 152, 116, 30, '#00287c');
    px(W / 2 - 58, 152, 116, 1, '#fcfcfc'); px(W / 2 - 58, 181, 116, 1, '#fcfcfc');
    drawText('CHOOSE HANDLE', W / 2, 156, '#f8d878', 1, 'center');
    drawText('< IN', W / 2 - 50, 168, G.spin === -1 ? '#f8d878' : '#9cc4dc');
    drawText('OUT >', W / 2 + 50, 168, G.spin === 1 ? '#f8d878' : '#9cc4dc', 1, 'right');
    const ar = G.spin === 1 ? '>>' : '<<';
    drawText(ar, W / 2, 168, '#fcfcfc', 1, 'center');
  }
  if (G.state === 'power' && !G.cpuTurn && Math.floor(G.t * 6) % 2)
    drawText('SPACE: SET WEIGHT', W / 2, 228, '#f8d878', 1, 'center');
  drawFeelChip();
  drawFlash();
}
function drawFeelChip() {
  const label = (tuneIdx + 1) + '.' + TUNE.name;
  px(0, 226, textW(label, 1) + 6, 12, '#00287c');
  drawText(label, 3, 229, '#f8d878');
}
function drawEndScore() {
  stripes('#00287c', '#0058f8', 20);
  px(12, 36, W - 24, 168, '#181818');
  px(12, 36, W - 24, 3, '#f8d878'); px(12, 201, W - 24, 3, '#f8d878');
  drawTextSh(G.extraEnd ? 'EXTRA END' : `END ${G.end}`, W / 2, 48, '#fcfcfc', '#d82800', 2, 'center');
  drawFace(0, 36, 76, 3);
  drawFace(1, W - 36 - 42, 76, 3);
  drawTextSh(`${G.scores[0]} - ${G.scores[1]}`, W / 2, 88, '#f8d878', '#000000', 3, 'center');
  if (G.endWinner >= 0) {
    const T = TEAMS[G.endWinner];
    drawTextSh(`${T.name}`, W / 2, 132, T.c1 === '#d82800' ? '#f87858' : '#3cbcfc', '#000000', 2, 'center');
    drawTextSh(`SCORES ${G.endPoints}!`, W / 2, 150, '#fcfcfc', '#000000', 2, 'center');
  } else {
    drawTextSh('BLANK END!', W / 2, 140, '#9cc4dc', '#000000', 2, 'center');
  }
  drawText(`HAMMER: ${TEAMS[G.hammer].short}`, W / 2, 176, '#f8d878', 1, 'center');
  if (Math.floor(G.t * 3) % 2) drawText('SPACE TO CONTINUE', W / 2, 214, '#fcfcfc', 1, 'center');
}
function drawGameOver() {
  const T = TEAMS[G.gameWinner];
  stripes(T.c2, T.c1, 35);
  px(12, 40, W - 24, 160, '#181818');
  px(12, 40, W - 24, 3, '#fcfcfc'); px(12, 197, W - 24, 3, '#fcfcfc');
  drawTextSh('CHAMPIONS!', W / 2, 52, '#f8d878', '#d82800', 2, 'center');
  drawFace(G.gameWinner, W / 2 - 28, 72, 4);
  drawTextSh(T.name, W / 2, 136, '#fcfcfc', '#000000', 2, 'center');
  drawTextSh(`${G.scores[0]} - ${G.scores[1]}`, W / 2, 158, '#f8d878', '#000000', 2, 'center');
  drawText(T.skip + ' TAKES THE TANKARD!', W / 2, 182, '#9cc4dc', 1, 'center');
  if (Math.floor(G.t * 3) % 2) drawText('PRESS ENTER', W / 2, 212, '#fcfcfc', 1, 'center');
}

function draw() {
  switch (G.state) {
    case 'title': drawTitle(); break;
    case 'menu': drawMenu(); break;
    case 'prethrow': drawPrethrow(); break;
    case 'endscore': drawEndScore(); break;
    case 'gameover': drawGameOver(); break;
    default: drawGame(); break;
  }
}

// ---------------------------------------------------------- main loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
if (typeof window !== 'undefined') { window.__C94 = G; window.__C94tune = () => TUNE; } // debug/testing hooks
