# Skyward Valley — MERPATI-7

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/zairzuab/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/zairzuab/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete 3D flight game that plays offline in a desktop browser. Fly the
single-prop tourer **MERPATI-7** over a seeded valley — green hills, a winding
river, a lake, a small town, a runway with edge lights, and snow-capped
mountains on the rim — with a backlit glass-cockpit HUD: altitude, airspeed,
vertical speed, heading compass, throttle, fuel, artificial horizon, score and
warnings.

## Three missions, three ways to fly

- **Ring Run** — fly through 8 glowing rings in order over the valley.
- **Canyon Run** — thread 6 low gates along the river, under 60 m.
- **Precision Landing** — land on runway 09 inside the touchdown zone, scored
  on softness, centreline and speed.

## Flying it

The flight model has lift that needs speed, a stall below it, throttle, drag,
gravity, fuel burn and damage — so a sortie is a set of decisions, not a
joyride. Controls: arrows pitch and roll, **A/D** rudder, **W/S** throttle,
**Space** airbrake, **G** gear, **C** chase/cockpit camera, **P** pause,
**R** restart, **M** mute; drag the mouse to look around. Sound is fully
synthesised (WebAudio engine hum, wind, ring chimes, touchdown thud) — no
audio files.

## How it is built

- `game/` — static files, no build step, no network at runtime. Three.js is
  vendored as `game/vendor/three.module.min.js`; every other file is the
  game's own code, split by job: `flight.js` (flight model), `terrain.js`
  (the valley), `aircraft.js` (the plane), `missions.js` (rings, gates,
  landing score), `hud.js` (instruments and screens), `audio.js` (synth),
  `input.js` (keyboard and mouse), `render.js` (cameras and sky),
  `shots.js` (deterministic screenshot scenes), `main.js` (boot and loop).
- `main.ts` (Node 22, standard library only) copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json` with the vendored
  make.fun library.
- `screenshots/` — 4 real renders of the game's own code (see `shots.json`
  for the deterministic `?shot=` scenes).
- Serve locally with `node serve.ts`, then open http://localhost:8080.

Entry for the [best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057)
on [make.fun](https://make.fun).
