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

1. **Core throw feel** — timescale, aim/power meter speed & difficulty ← EXP-01 (active)
2. **Sweeping** — input scheme (mash vs rhythm vs hold), rescue power
3. **Collision/takeout drama** — impact feedback, shake, sound, slow-mo?
4. **CPU personality & difficulty** — strategy variety, fairness, taunts
5. **Presentation** — title, splashes, story beats between ends
6. Holistic pass — pacing of a full end, scoring clarity

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

**Verdict:** _pending_

## Locked-in values

- Feel profile: **CLASSIC** (default, EXP-01). Lab keys 1-4 kept for
  future reference.
- Throw flow: handle → aim → hold-release weight (EXP-02, pending
  verdict).

## Raw feedback archive

- 2026-06-09: "ok it works great" — v1 baseline approved, no specific complaints.
- 2026-06-09 (EXP-01): "1 is the closest to the feel... a bit hard to
  hit the broom and to hit the weight and you have to judge that." Plus:
  choose turn before aiming; weight should be hold-release continuation
  of the aim press.
