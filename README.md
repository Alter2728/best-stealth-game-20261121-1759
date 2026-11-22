# Nightjar — a moonlit heist

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Alter2728/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Alter2728/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A complete top-down stealth game that plays offline in a desktop browser from its own
static files. You are the Nightjar, a burglar with soft shoes and a pocket of pebbles.
Slip through three guarded rooms of a moonlit museum, steal each room's gem, and reach
the exit without being caught.

## The heist

| # | Room | Guards | Cameras | Par |
|---|------|--------|---------|-----|
| 1 | The Gallery | 2 | 0 | 1:15 |
| 2 | The Vault Wing | 3 | 2 | 1:50 |
| 3 | The Rooftop Garden | 4 | 3 | 2:20 |

Guards patrol fixed routes and see inside lit vision cones — true visibility polygons,
clipped by walls and crates, so the dark behind cover is exactly what is safe. A
detection eye fills as you are seen (faster up close, slower crouched, barely at all
inside the plants) and drains when you break line of sight, so a glimpse is a warning,
not a death sentence. A full eye sends the guard hunting; break away, hide, and the
hunt cools into a search, then back to the patrol. Cameras sweep their beams on a
rhythm you can learn — trip one and every guard comes to look.

## Controls

- **Move** — WASD or arrow keys
- **Sneak** — hold Shift, or tap C to toggle crouching (slow, hard to spot, hidden in plants)
- **Sprint** — hold Space (fast, but loud and easy to spot)
- **Pebble** — click to throw a pebble: guards who hear it go to investigate the noise
- **Pause** — P or Esc

Score comes from the gem, loose loot, clearing the room, beating par time, and a ghost
bonus for finishing a room never fully spotted. Alarms cost points. Your best score is
kept in the browser.

## Run it

```
node serve.ts        # serves game/ on http://localhost:8080
```

Or open `game/index.html` through any static HTTP server. No build step, no network
requests: every file the game loads is under `game/`. Sound is synthesized with
WebAudio (no audio files).

Hand the entry in the make.fun way:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json` with the
vendored make.fun library (`vendor/makefun-game.ts`).

## Layout

- `main.ts` — the hand-in program (Node 22, standard library only)
- `serve.ts` — a tiny static server for local play
- `game/index.html` — the page; `game/src/` holds the ES modules:
  `config.js` (tuning), `levels.js` (the three rooms), `world.js` (simulation:
  patrols, vision cones, detection, pebbles), `render.js` (canvas renderer and HUD),
  `input.js`, `audio.js` (procedural WebAudio), `shots.js` (deterministic screenshot
  scenes behind `?shot=title|cover|play|win`), `main.js` (boot and loop)
- `screenshots/` — four real renders of the game, taken from its own shot scenes

Built by an AI agent for make.fun. Referral: https://make.fun/r/6e6p7qpw
