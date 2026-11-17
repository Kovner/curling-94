# CURLING '94 — Design & Experiment Log

How we work (agreed 2026-06-09): Claude acts as PM/designer/engineer and
iterates aspect-by-aspect. Each iteration ships a hypothesis + an in-game
variant lab (hot-switchable, so one playtest yields a ranking, not a bit).
Mike plays for ~2 minutes and replies with as little as a number and a
phrase. Verdicts get logged here, the winner becomes the new default, and
the lab moves to the next backlog item. Every ~3 iterations: one holistic
full-game playtest. This file is the durable memory between sessions —
log every verdict and locked-in value here.

Play URL: https://kovner.github.io/curling-94/ — auto-redeploys on every
push to the branch (Pages enabled 2026-06-09). Hard-refresh if a new
build doesn't show.

## Where things stand (2026-11-17)

Waiting on Mike's playtest of three things, all live:

1. **EXP-07** unmarked, faster weight bar — is weight now judged from
   the split?
2. **EXP-08** throw lab (keys 1-3) — TAP vs HOLD vs HOLD FAST.
3. **EXP-09** living ice — does the sheet feel alive and readable?

## Backlog (impact-on-fun order)

1. ✅ Core throw feel — CLASSIC tuning (EXP-01), handle-first (EXP-02)
2. ✅ Real curling timing — stopwatch in sim seconds (EXP-03), 14.0s ice
   and skip cam (EXP-05)
3. 🔬 Weight input — stop-position bar (EXP-06), unmarked (EXP-07),
   one-pass hold variant (EXP-08)
4. 🔬 Living ice — EXP-09 is the first cut; tune from playtests
5. **Sweeping** — input scheme (mash vs rhythm vs hold) and how much a
   sweep should rescue. Sweeping currently adds up to ~39% carry, which
   on living ice hides a 3m misread of fresh pebble. Next lab.
6. **Collision/takeout feedback** — impact shake, sound, freeze-frame
7. **CPU depth** — more shot types, checks for guards in its path,
   free-guard-zone rule for both sides, personality per skip
8. **Story mode** (Mike, 2026-11-17: after the ice feels right) — a
   Punch-Out style climb through named rival skips, each with a face,
   a taunt and a play style, up to "The Tankard"
9. Touch controls (keyboard-only today, so unplayable on a phone)
10. Holistic pass — pacing of a full end, scoring clarity

## Architecture (since the 2026-11-17 refactor)

- `physics.js` is pure (no DOM, no game state): sheet geometry, the ice
  model, the single stone integrator `stepStone`, collisions, offline
  simulation, the weight scale, seeded RNG. Tests `require()` it.
- **Ice is an object** with `decelAt(y, z)` and `curlAt(y, z)`. Nothing
  reads a friction constant any more. `makeIce()` is uniform nominal
  ice; `makeLivingIce(seed)` is a generated sheet (EXP-09).
- **The weight bar is tied to nominal ice on purpose.** The same bar
  position is always the same release speed; the ice on the day decides
  where the stone stops. So on a slow sheet "draw position" comes up
  short, exactly like a real thrower's muscle memory.
- **The CPU does not know the sheet.** It plans against a belief
  (`G.cpuIce`, uniform speed + curl) that starts from the icemaker's
  report and moves halfway to the truth after every stone it watches.
  Measured over 300 sheets: its first draw is ~3m light on fresh pebble
  (rescued by sweeping), and it has the speed within ~17cm by stone 4.
- All gameplay randomness goes through one seeded generator, so a game
  replays exactly from its seed (`seedGame(n)`).
- `game.js` is still one state-machine `switch` with CPU and human
  logic interleaved per state. Untangle it when sweeping variants or
  story mode next touch it.
- The refactor was checked bit-for-bit against the old code on 103
  recorded cases (stepped throws at 30/60/144 fps, a three-stone hit,
  offline sims, aim solves, the meter curve) before anything changed.

## Research: real curling timing (for backlog item 2)

Customer requirement: weight is judged by eye and by interval timing;
even a "sped up" game should keep hog-to-hog draw time ≈ **13.5–15s**.

Findings (curltech.com/timing-rocks, lanarkcurlingclub.org timing PDF):
- **Hog-to-hog (HTH)** for a draw stopping on the tee: ~13.0–14.5s on
  normal ice; championship ice 14.7–15.0s; ±0.5s is normal game drift.
  Skips track HTH constantly to read ice speed ("are we still 14.5?").
- **Split time** (back line → near hog) is the thrower-side readout:
  draws ~3.75–4.00s; hack weight ~3.40s; normal hit ~3.00s; peel ~2.75s.
  Rule of thumb: 0.1s of split ≈ 6 feet of carry.
- Our physics already produces ~13.1s HTH in sim units (a≈0.092 was
  calibrated to real ice), so this is mostly **setting TS ≈ 1.0 during
  the slide** + tuning, not new physics.

Design sketch (CLARIFIED by Mike 2026-06-09): timing maps to real
curling but playback stays sped up — the stopwatch displays
**simulation seconds** (canonical curling time), not wall-clock. At 2x
playback a 3.6 split shows as 3.6 even though you watched 1.8s. Our
physics already runs in real units internally, so this is just a HUD
counting sim-time: split flashed at the near hog, live HTH, final HTH
on stop. NES-style stopwatch graphic. Weight zones on the meter could
eventually be REPLACED by learning your splits (the meter becomes
delivery effort, the stopwatch becomes truth). Experiment also tests
2-3 playback speeds with the watch running to find where motion is
still eye-readable. (Earlier pacing concern about near-real-time rides
is void — playback speed stays arcade.)

## Research: living ice conditions (for backlog item 4)

Customer requirement: mostly consistent but not perfect across the
sheet; changes throughout the game; every game has slightly different
base conditions.

Findings (curltech.com/ice-and-rocks, curlingbasics.com, olympics.com,
smithsonianmag.com):
- **Pebble** (frozen water droplets sprayed pre-game) is what stones
  ride on. Its state drives everything: fresh pebble starts slightly
  slow/straight, **keens up** over the first ends as droplet heads round
  off (HTH drifting ~13.0→14.2s), then **breaks down** late — slower,
  straighter, "flat spots."
- **Spatial variation**: center of the sheet is most level and most
  used — the heavy-traffic center path polishes faster/straighter over
  a game; outside edges are riskier (frost film, and on bad ice
  "negative ice"/falls where stones fall against the turn). Sides of a
  sheet can swing differently.
- **Magnitudes**: speed ±0.5s HTH within a game is normal; curl is
  ~4 ft (club) to 5–6 ft (championship) and changes as pebble wears.
  Warm surface (23–24°F) = faster + swingier; cold/frosty (21–22°F) =
  slower + straighter. Humid air = lubricated, straighter ice.
- Teams designate someone to watch tracks and patterns — *reading the
  ice is a core skill the sim should reward*.

Design sketch: per-game seed → base HTH (13.5–15.0s) + base curl
(3.5–6 ft) + a smooth low-frequency noise field over the sheet (keen and
heavy zones, one swingy side); slow drift over ends along the
keen-up-then-break-down arc; a wear/polish field that builds along
actual stone tracks during play. Pre-game "ICE REPORT" card (very 90s
TV) gives a hint, but the truth is learned by throwing and timing.
CPU must read ice too or it'll feel psychic/unfair.

## Experiment log

### EXP-01: Throw feel sweep (closed: CLASSIC won)

**Hypothesis:** the core loop's fun is dominated by (a) how fast the stone
ride feels and (b) meter speed = skill ceiling. Current CLASSIC tuning may
be too slow between the hog lines and too forgiving on the meters.

**Lab:** keys **1–4** switch profiles live, any time, mid-throw included.
Current profile shows bottom-left; choice persists in localStorage.

| # | Name | Time scale | Aim arrow | Power meter | Curl | Sweeping |
|---|------|-----------|-----------|-------------|------|----------|
| 1 | CLASSIC | 2.4x | medium | 1.3s cycle | 1.0m bend | balanced |
| 2 | ARCADE | 3.4x (zippy) | fast | 0.95s | straighter | strong rescue, easy |
| 3 | SIM | 1.7x (heavy) | slow | 1.8s | big 1.4m bend | subtle, strategic |
| 4 | TWITCHY | 2.4x | very fast | 0.75s | 1.0m | decays fast, real mashing |

**Ask:** which profile, and what single thing is still off in it?

**Verdict (2026-06-09):** **CLASSIC (1) wins.** "Closest to the feel we
should be going for. It's a bit hard to hit the broom and to hit the
weight and you have to judge that" — difficulty is on the hard edge but
the judgment is part of the game; don't soften it, make it more
*judgeable* instead. Two flow changes requested → EXP-02.

### EXP-02: Throw flow rework (closed: handle-first kept, hold-release rejected)

Direct customer feedback, both about honesty and fluidity of the motion:

1. **Handle before aim.** Old order let you pick curl after seeing your
   locked aim — adjusting the turn to rescue a bad lock. New order:
   prethrow → CHOOSE HANDLE → aim → weight. Commit to the turn first,
   like a real skip's call.
2. **One-motion delivery.** Pressing Space locks the aim AND immediately
   starts the weight bar rising; releasing Space releases the stone at
   that weight. No more separate oscillating power phase for humans.
   (CPU animates the same ramp.)
3. Added: audio ticks as the rising bar crosses GRD/DRW/HIT marks, so
   weight can be judged by ear mid-hold (helps the "hard to judge
   weight" note without making it easier mechanically).

**Verdict (2026-06-09): SPLIT.** Handle-before-aim: ✅ keep. One-motion
hold-release weight: ❌ "too hard" — reverted to the separate
oscillating meter with a tap to lock. Lesson: continuous-motion inputs
read as elegant on paper but the release timing stacked aim stress onto
weight stress with no reset between them. The oscillating meter gives
you a beat to breathe and re-focus. (Weight-tick sounds removed with it;
the stopwatch experiment is the real answer to weight judgment anyway.)

### EXP-03: Stopwatch — canonical curling time (closed: in use)

**Hypothesis:** showing real interval times (independent of playback
speed) lets weight be judged the way real curlers judge it, and turns
ice speed into something you *learn* during a game — prerequisite for
the living-ice item.

**Build:** stopwatch panel (top-left, during the slide and after) runs
on SIM seconds, so numbers are canonical curling times no matter the
playback speed. SPL = release-to-near-hog split (real draw splits are
~3.75-4.0s; ours read ~0.2-0.4 lower since the clock starts at release,
not the back line). H-H = hog-to-hog, counting live between the lines,
frozen once across (draws ~13-14, hits ~7-9). Click sound at each hog
crossing. Shows on CPU throws too — that's how skips read the ice.

**Verdict:** never given directly. Treated as accepted (Claude's
reading): on 2026-11-17 Mike asked for the weight bar's guidelines to
be removed "so you have to use the short split time to judge". The
previous stone's H-H (PRV) was added with living ice.

### EXP-04: Curl physics fix + near house + slide-out delivery (closed)

**Bug (Mike):** heavy hits appeared to curl the wrong way; "a super
heavy hit would just go dead straight." Investigation: the model never
reverses direction (verified numerically — drift is always spin-ward),
but the curl floor (curlG min 0.12 at any speed) gave hits a few cm of
bend, and a locked-off-axis aim reads as wrong-way bend. Both bad.

**Calibration source — curling.gg:** read their bundle. Their
recommended curl model ("hybridSpeedDependent", ~5ft at tee): lateral
accel ≈ ZERO above a speed threshold, CONSTANT below it, cutoff when
nearly stopped (v<0.1). Adopted that shape in real units: curl engages
below ~2.1 m/s (full by 1.7), zero above. Result: draw/guard ≈ 1.2m
(4 ft) of curl, normal hit ≈ 4cm, peel ≈ 0.000m dead straight. Also
fixed handle rotation to ~2-3 turns per throw at any weight (was
speed-proportional and comically fast on hits).

**Also (Mike):** near house + thrower slides out, for sim feel. Done:
real near-end geometry (hack 0 → back line 1.83 → tee 3.66 → hog 10),
both houses rendered, thrower glides hack→near-tee at the throw's
actual speed and releases at the tee. Stopwatch now starts at the BACK
LINE crossing like a real timer, so SPL is a true back-to-hog split
(draws ~3.3s here vs 3.75-4.0 real — close, our release speed differs).

**Addendum (split accuracy, Mike's question):** with release at the
near tee, splits read 0.2-0.4s fast vs real tables — real timers see
the stone carried at ~release speed through most of the back-to-hog
zone. Fix: release point moved to y=9.0, just before the hog (which is
also the real delivery). Verified against the curltech tables on our
13.0-HTH ice: draw 3.52 (real ~3.6), hack 3.12 (~3.4), normal hit 2.77
(~3.0), peel 2.37 (~2.5-2.75) — within ~0.1-0.3s across the range, with
the residual mostly ice-speed reference differences. Camera now tracks
the glide.

**Addendum 2 ("CCW went right", Mike):** re-verified in-game physics
empirically: CW bends only right, CCW only left, peels exactly 0.000m
both ways. Root cause was readability: the locked aim angle left no
trace on screen, so a dead-straight stone on a slightly-right line
reads as wrong-way curl. Fix: the delivery line stays faintly dotted
on the ice during the throw with a skip's broom marker at its tee-line
crossing — curl now reads as deviation from the line, like real ice.
Also relabeled the handle picker from IN/OUT (handedness-ambiguous) to
CCW/CW + explicit 'CURLS LEFT/RIGHT'.

**Addendum 3 (root cause found by Mike):** the minimap was projecting
the curl-compensated landing point, training the player to aim the
OUTCOME at the button instead of aiming the broom. On hits the
projection is near-straight, so the target's meaning flipped between
shot types — that's the "wrong way" feel. Fix: minimap now shows the
straight broom line only (with broom marker at the tee crossing, same
as on the ice). Calling the right amount of ice is the player's skill
now, like real curling: draw = aim ~4ft wide, let it come home. No
curl preview anywhere.

**Verdict:** no direct verdict; no complaints about curl direction or
aiming reference since the broom-line change, so treated as settled
(Claude's reading).

### EXP-05: Skip cam + 14s ice (closed: locked in)

**Feedback (Mike):** aiming too hard — minimap too small to place the
broom precisely. And draw-to-button was reading 13.2 H-H; should
average ~14.0 (occasionally 13.5, occasionally 15.0).

**Build:**
- **Skip cam**: big house close-up panel (top centre) during
  aim/handle/weight, with the broom + dotted line sweeping across it.
  You call the shot from the house like a skip — ~12x the lateral
  resolution of the minimap. Also slowed the CLASSIC aim arrow a touch
  (2.4 -> 2.0 rad/s).
- **Ice speed**: A0 0.092 -> 0.080. Draw-to-button now exactly 14.0
  H-H with a 3.77 split (real table: 3.85). Curl rescaled to 4.8 ft on
  a draw; peels still 0.000m.

**Living-ice spec from the customer (for the backlog item):** per-game
base mostly 14.0, occasionally 13.5 or 15.0; with ice evolution, often
13.0-13.5 on the first few rocks of a game, then the sheet keens up.

**Verdict (2026-06-13):** aiming "way better" — skip cam locked in.
New issue → EXP-06.

### EXP-06: Stop-position weight meter (closed: scaling kept, was too easy)

**Feedback (Mike):** weight control too hard, draw area of the bar
really small. Root cause: bar was linear in velocity but stop distance
goes with v² — the entire house occupied ~7% of the bar (button window
~10ms). Rebuild: the meter is now linear in STOP POSITION through the
finesse zone — hog-to-back-line placement gets 56% of the bar (draw
tick at p=0.555), hit weights compressed into the top 32%, short/hogged
bottom 12%. Button window now ~45ms (5x). Zones redrawn from the same
mapping so GRD/house/DRW/HIT are all big and honest.

**Verdict (2026-11-17):** stop-position scaling works, but now "just a
bit too easy" → EXP-07.

### EXP-07: Unmarked, slightly faster weight meter (ACTIVE)

**Feedback (Mike):** speed the meter up a tiny bit, and remove the
guidelines so weight has to be judged from the split time — "maybe no
guidelines at all".

**Build:** CLASSIC meter cycle 1.3s → 1.15s (~12% faster). The bar is
now plain: no guard/house/hit zones, no draw tick, no labels. The
stop-position scaling underneath is unchanged, so equal distances of
ice are still equal slivers of bar — you just can't see where they are.
The stopwatch split is the only readout of what you threw.

**Verdict:** _pending_

### EXP-08: Throw lab — one-pass hold-to-throw (ACTIVE)

**Idea (Mike, 2026-11-17):** make shooting harder. Press Space when the
line is where you want it; that starts the meter, which runs until you
let go. It does not go up and down, so you get one quick try.

This is the EXP-02 mechanic that was "too hard" in June. What changed
since: the bar is linear in stop position (the button window is ~5x
wider than it was then), aiming has the skip cam, and weight in TAP
mode is now "a bit too easy". Worth another look.

**Lab:** keys **1-3**, live, remembered; mode shows bottom-left.

| # | Mode | Aim | Weight |
|---|------|-----|--------|
| 1 | TAP | tap to lock | bar oscillates (1.15s cycle), tap to set |
| 2 | HOLD | press to lock | bar climbs once while held, 0.8s to the top; release throws; tops out = full weight |
| 3 | HOLD FAST | press to lock | same, 0.575s to the top (the TAP bar's sweep speed) |

In HOLD a draw is a ~0.44s hold and a metre of ice is ~54ms; in HOLD
FAST ~0.32s and ~39ms.

**Ask:** which mode, and is the climb speed right?

**Verdict:** _pending_

### EXP-09: Living ice, first cut (ACTIVE)

**Spec (Mike):** mostly consistent but not perfect across the sheet;
changes during the game; every game a little different; base mostly
14.0 hog-to-hog, occasionally 13.5 or 15.0; often 13.0-13.5 on the
first few rocks, then it speeds up.

**Build** (`makeLivingIce(seed)`, one sheet per game):
- **Between games:** base speed 60% ~14.0, 20% ~13.5, 20% ~15.0 (each
  ±0.15); draw curl ~4.0-6.0 ft, more on quicker sheets; one side of
  the sheet swings more than the other; keen and heavy patches (±3.5%)
  from a seeded noise field.
- **During a game:** fresh pebble starts 0.6-0.9s slow and keens up
  over the first handful of stones (a 14.0 sheet reads about 13.3,
  13.75, 14.0 on stones 1, 4, 13). After 40-55 stones the pebble
  breaks down: up to 0.6s slower and 25% straighter.
- **Where you throw:** the outside edges are frosty (up to 7% heavier);
  every stone polishes its lane, which gets up to 4.5% quicker and 12%
  straighter after about ten passes.
- **ICE REPORT** card before the game: speed and curl rounded to the
  nearest half, and a note that the pebble is fresh. Nothing about the
  patches, the swingy side or how slow "fresh" is.
- **Stopwatch** now also shows the previous stone's hog-to-hog (PRV).
- **Menu:** ICE: LIVING (default) or PERFECT (uniform nominal ice, no
  report) for comparison.
- The CPU learns the sheet from the report plus watching stones (see
  Architecture).

**Ask:** play a full game on LIVING. Can you feel the fresh pebble and
the keen-up through the splits? Are the magnitudes right, too subtle,
or too much? Does the CPU feel fair?

**Verdict:** _pending_

## Locked-in values

- **Feel (EXP-01):** playback 2.4x, aim arrow 2.0 rad/s over ±4.2°,
  sweep +0.34 per press, -1.1/s decay.
- **Throw order (EXP-02):** handle, then aim, then weight.
- **Aiming (EXP-04/05):** broom line only, no curl preview anywhere;
  skip cam while aiming; the delivery line stays on the ice during the
  throw; handles labelled CCW/CW with the curl direction spelled out.
- **Timing (EXP-03/04/05):** stopwatch in sim seconds; SPL is back line
  to near hog, H-H is hog to hog; release just before the near hog.
- **Nominal ice (EXP-05):** 0.080 m/s² = 14.0s hog-to-hog and a 3.77s
  split on a draw to the button; 4.8 ft of draw curl.
- **Curl model (EXP-04):** zero above 2.1 m/s, full below 1.7; peels
  run exactly straight.
- **Weight bar (EXP-06/07):** linear in stop position on nominal ice
  (hog-to-back-line zone is 56% of the bar, draw at 0.555); unmarked;
  1.15s cycle in TAP mode.

## Raw feedback archive

- 2026-06-09: "ok it works great" — v1 baseline approved, no specific complaints.
- 2026-06-09 (EXP-01): "1 is the closest to the feel... a bit hard to
  hit the broom and to hit the weight and you have to judge that." Plus:
  choose turn before aiming; weight should be hold-release continuation
  of the aim press.
- 2026-06-13: "Aiming is way better... weight control is really hard
  because the draw area of the weight bar is really small."
- 2026-11-17 (EXP-06): "weight control is just a bit too easy. speed it
  up a tiny bit. and there should be fewer guidelines in the meter...
  Maybe no guidelines at all."
- 2026-11-17: "do all the things on your roadmap. After we get the
  feeling of ice and 'living' ice down then we can turn this into a
  Mike Tyson's punchout style story." Plus the one-pass hold-to-throw
  idea (EXP-08).
