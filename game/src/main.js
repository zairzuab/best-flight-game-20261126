// Skyward Valley — boot and the one loop. The game moves between four screens:
// menu, play, paused, and the crash or mission-complete screens. Fixed 1/60 s
// steps keep the flight model identical every run; the renderer paints what
// is there. ?seed=N fixes the valley. ?shot=cover|rings|canyon|landing (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { WORLD } from './config.js';
import { createTerrain } from './terrain.js';
import { createAircraft } from './aircraft.js';
import {
  createFlight, placeFlight, stepFlight, flightReadouts,
  EVENT_CRASHED, EVENT_LANDED, EVENT_FUEL_EMPTY,
} from './flight.js';
import {
  MISSION_RINGS, MISSION_CANYON, MISSION_LANDING,
  createMission, updateMission, highlightNext, scoreLanding,
} from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import {
  createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, ACTION_CAMERA, ACTION_MUTE,
} from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const BEST_KEY = 'skyward-valley-best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : WORLD.seed;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const terrain = createTerrain(seed);
const aircraft = createAircraft();
const renderer = createRenderer(canvas, terrain, aircraft);
const hud = createHud(document);
const audio = createAudio();
const input = createInput(canvas);

let flight = createFlight(terrain);
let mission = createMission(MISSION_RINGS, seed, terrain);
let missionGroup = mission.group;
renderer.scene.add(missionGroup);
let missionKind = MISSION_RINGS;
let screen = 'menu';
let cameraMode = 'chase';
let best = readBest();
let time = 0;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function startMission(kind) {
  missionKind = kind;
  renderer.scene.remove(missionGroup);
  mission = createMission(kind, seed, terrain);
  missionGroup = mission.group;
  renderer.scene.add(missionGroup);
  flight = createFlight(terrain);
  placeFlight(flight, mission.startPose());
  screen = 'play';
  hud.showScreen(null);
  audio.start();
  status.textContent = `${mission.info.name}. ${mission.info.blurb}`;
}

function endCrash() {
  screen = 'crash';
  audio.crash();
  if (mission.score > best) {
    best = mission.score;
    saveBest(best);
  }
  hud.showCrash(flight.crashReason || 'Crashed', mission.score);
  status.textContent = `Crashed. ${flight.crashReason}. Score ${mission.score}.`;
}

function endComplete(title, lines, score) {
  screen = 'complete';
  audio.fanfare();
  if (score > best) {
    best = score;
    saveBest(best);
  }
  hud.setBest(best);
  hud.showComplete(title, lines, score);
  status.textContent = `${title}. Score ${score}.`;
}

function runShot(name) {
  const game = { terrain, seed };
  const staged = stageShot(name, game);
  flight = game.flight;
  renderer.scene.remove(missionGroup);
  mission = game.mission;
  missionGroup = mission.group;
  renderer.scene.add(missionGroup);
  hud.showScreen(null);
  let painted = 0;
  function paint() {
    const readouts = flightReadouts(flight);
    hud.update(readouts, flight, mission);
    highlightNext(mission, 1.2);
    renderer.draw(flight, mission, cameraMode, { x: 0, y: 0 }, 1.2, 1 / 60);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  hud.setBest(best);
  hud.showScreen('menu');
  hud.bindMissionButtons((kind) => startMission(kind));
  status.textContent = 'Skyward Valley. Pick a mission to fly.';
  let accumulator = 0;
  let last = performance.now();

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.toggleMute();
      return;
    }
    if (actions & ACTION_CAMERA) cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    if (screen === 'menu') {
      if (actions & ACTION_CONFIRM) startMission(missionKind);
    } else if (screen === 'play') {
      if (actions & ACTION_PAUSE) {
        screen = 'pause';
        hud.showScreen('pause');
        status.textContent = 'Paused.';
      } else if (actions & ACTION_RESTART) {
        startMission(missionKind);
      }
    } else if (screen === 'pause') {
      if (actions & ACTION_PAUSE) {
        screen = 'play';
        hud.showScreen(null);
        status.textContent = 'Flying.';
      } else if (actions & ACTION_RESTART) {
        startMission(missionKind);
      }
    } else if (screen === 'crash' || screen === 'complete') {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startMission(missionKind);
    }
  }

  function step() {
    const controls = input.controls();
    controls.gearToggle = input.takeGearToggle();
    const events = stepFlight(flight, controls, STEP);
    const missionEvent = updateMission(mission, flight, terrain);
    if (missionEvent === 'passed') {
      audio.chime();
      status.textContent = `Ring ${mission.passed} of ${mission.targets.length}.`;
    } else if (missionEvent === 'complete') {
      endComplete(
        `${mission.info.name} complete!`,
        [`Targets cleared: ${mission.passed}/${mission.targets.length}`, `Time ${formatClock(mission.time)}`, 'Course bonus +250'],
        mission.score,
      );
      return;
    }
    if (events & EVENT_CRASHED) {
      endCrash();
      return;
    }
    if (events & EVENT_LANDED) {
      if (missionKind === MISSION_LANDING) {
        const result = scoreLanding(flight);
        endComplete(
          'Precision landing!',
          [`Softness ${result.softness}/100`, `Centreline ${result.centre}/100 — ${result.centreErrorM} m off`, `Speed ${result.speed}/100 — ${result.vspeed} m/s down`],
          result.total,
        );
      } else {
        endComplete('Landed safely', [`Score ${mission.score}`, 'The sortie is over — the plane is down.'], mission.score);
      }
      return;
    }
    if (events & EVENT_FUEL_EMPTY) status.textContent = 'Fuel empty — gliding.';
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    if (screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== 'play') break;
      }
      if (screen === 'play') {
        const readouts = flightReadouts(flight);
        hud.update(readouts, flight, mission);
        highlightNext(mission, time);
        audio.update(flight.throttle, flight.speed, flight.stalled, time);
        renderer.draw(flight, mission, cameraMode, input.look(), time, dt);
      } else {
        // The step ended the flight: paint the final frame under the overlay.
        renderer.draw(flight, mission, cameraMode, input.look(), time, dt);
      }
    } else if (screen === 'menu') {
      // The menu shows the valley from a slow orbit while the plane sits ready.
      flight.heading += 0.02 * dt;
      renderer.draw(flight, mission, 'chase', { x: 0, y: 0 }, time, dt);
    } else {
      renderer.draw(flight, mission, cameraMode, input.look(), time, dt);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      hud.showScreen('pause');
      status.textContent = 'Paused.';
    }
  });

  window.addEventListener('resize', () => {
    renderer.resize(window.innerWidth, window.innerHeight);
  });
  renderer.resize(window.innerWidth, window.innerHeight);

  requestAnimationFrame(frame);
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

if (shot) runShot(shot);
else runGame();
