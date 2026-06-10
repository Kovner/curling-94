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

## Backlog (impact-on-fun order)

1. **Core throw feel** — EXP-01 ✅ (CLASSIC) → EXP-02 flow rework (verdict pending)
2. **Real curling timing & weight-by-eye** (Mike, 2026-06-09) — see
   research below. Proposed BEFORE sweeping because sweep pacing depends
   entirely on how long the ride is.
3. **Sweeping** — input scheme (mash vs rhythm vs hold), rescue power —
   re-tuned on top of real timing.
4. **Living ice conditions** (Mike, 2026-06-09) — the big one; see
   research below. Goal: simulate the *nature of playing a curling
   game* — reading and adapting to ice — not just executing shots.
5. **Collision/takeout drama** — impact feedback, shake, sound, slow-mo?
6. **CPU personality & difficulty** — strategy variety, fairness, taunts;
   must also *read the ice* once item 4 lands.
7. **Presentation** — title, splashes, story beats between ends
8. Holistic pass — pacing of a full end, scoring clarity

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

### EXP-01: Throw feel sweep (ACTIVE)

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

### EXP-02: Throw flow rework (ACTIVE)

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

## Locked-in values

- Feel profile: **CLASSIC** (default, EXP-01). Lab keys 1-4 kept for
  future reference.
- Throw flow: **handle → aim (tap) → oscillating weight meter (tap)**
  (EXP-02 final).

## Raw feedback archive

- 2026-06-09: "ok it works great" — v1 baseline approved, no specific complaints.
- 2026-06-09 (EXP-01): "1 is the closest to the feel... a bit hard to
  hit the broom and to hit the weight and you have to judge that." Plus:
  choose turn before aiming; weight should be hold-release continuation
  of the aim press.
