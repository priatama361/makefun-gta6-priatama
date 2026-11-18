# Solana Bay — Sunny Side Up

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/priatama361/makefun-gta6-priatama/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/priatama361/makefun-gta6-priatama/reward.svg)](https://make.fun/bounty/gta6-01)

[Bounty on make.fun](https://make.fun/bounty/gta6-01)

A browser-playable, sun-soaked open-world crime story built from local static files only.

You play **Mara "Sunny" Vega**, a getaway driver back on the Sun Coast. Work through an
ordered chain of six missions for three original contacts — **Tito Alvarez**, **Dana
Kestrel** and **Vivian Cross** — across the pastel streets, palm-lined boardwalk and
turquoise harbor of Solana Bay. Money, reputation, rank and story position persist in
`localStorage`.

## Play

```bash
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no install and no
network request: every asset is generated locally by the game's own modules.

## Controls

| Action | Keys |
| --- | --- |
| Run / drive / steer | WASD or arrow keys |
| Sprint | Shift |
| Enter or exit a car, rob a store, take a mission pickup | E |
| Aim and fire | Mouse or J |
| Swap pistol / SMG | Q |
| Reload | R |
| Handbrake | Space (while driving) |
| Pause | P or Escape |
| Mute | M |
| New story (clears save) | N on the title or busted screen |

## Systems

- Walkable and drivable city with traffic, pedestrians, shops and named landmarks.
- Cars to steal, damage and destroy; police cruisers and officers that chase and shoot.
- Wanted stars from one to five, with heat that decays only when you evade the police.
- Story missions with step-by-step objectives, markers, timers and cash / reputation rewards.
- Rank progression from Street Rookie to King of Solana Bay, shown in the HUD.
- Combat with muzzle flashes, sparks, smoke, screen shake and synthesized sound cues.
- High-contrast minimap, wanted stars, mission compass, health, armor, ammo and speedometer.
- Start screen, pause screen, busted screen and persistent progress.

## Screenshots

`screenshots/` holds four unedited 1280×720 JPEG captures of staged live gameplay:
a high-speed police pursuit, a boardwalk walk, a shootout and a mission-complete moment.
`shots.json` lists the URL query used for each capture.
