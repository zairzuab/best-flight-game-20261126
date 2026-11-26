// The screenshot scenes behind ?shot=cover|rings|canyon|landing. Each one plays
// the real flight model forward from a staged pose, steered by a gentle
// autopilot toward the next target, so the frame is what a short game really
// looks like — and the same seed always gives the same frame.
import { MISSION_RINGS, MISSION_CANYON, MISSION_LANDING, createMission, updateMission } from './missions.js';
import { createFlight, placeFlight, stepFlight } from './flight.js';
import { riverX } from './terrain.js';
import { clamp } from './random.js';

const STEP = 1 / 60;

/** Wrap an angle to -PI..PI. */
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Steer toward a point beyond the next target: bank gently into the heading
 * error, pitch for altitude. Aiming beyond the target keeps the plane level
 * instead of chasing a point it is about to pass.
 */
function autopilotControls(flight, target) {
  const dx = target.x - flight.x;
  const dz = target.z - flight.z;
  const wantHeading = Math.atan2(dx, -dz);
  const headingError = wrapAngle(wantHeading - flight.heading);
  const wantPitch = clamp((target.y - flight.y) * 0.004, -0.35, 0.35);
  return {
    pitch: clamp((wantPitch - flight.pitch) * 2.2, -1, 1),
    // Positive roll banks left and turns the heading down, so turning
    // toward a heading error needs the opposite sign.
    roll: clamp(-headingError * 0.9, -0.7, 0.7),
    rudder: 0,
    throttleDelta: clamp((46 - flight.speed) * 0.02, -0.5, 0.5),
    airbrake: false,
    gearToggle: false,
  };
}

/**
 * Stage the named scene on a fresh flight and mission, run the model forward
 * briefly under the autopilot, and return the screen to paint over it.
 */
export function stageShot(name, game) {
  const { terrain, seed } = game;
  let kind = MISSION_RINGS;
  let pose;
  let passed = 0;
  let target;
  let simSeconds = 1.5;

  if (name === 'canyon') {
    kind = MISSION_CANYON;
    passed = 2;
    // Low over the river, at gate height, flying south down the river
    // toward the next gates. Close enough that the green gate reads.
    pose = { x: riverX(-560), y: 42, z: -560, heading: Math.PI, pitch: 0, speed: 50, throttle: 0.6, gearDown: false };
    target = { x: riverX(-50), y: 36, z: -50 };
    simSeconds = 0.6;
  } else if (name === 'landing') {
    kind = MISSION_LANDING;
    // On final, gear down, a gentle descent onto the threshold.
    pose = { x: 280, y: 38, z: 4, heading: Math.PI * 1.5, pitch: -0.04, speed: 38, throttle: 0.35, gearDown: true };
    target = { x: 150, y: 26, z: 0 };
    simSeconds = 1.5;
  } else if (name === 'rings') {
    kind = MISSION_RINGS;
    passed = 4;
    // Short of ring 4, on the course from ring 3, aiming past it so the
    // plane stays level and the glowing ring sits ahead in the frame.
    pose = { x: -170, y: 140, z: 440, heading: 2.34, pitch: 0.05, speed: 48, throttle: 0.62, gearDown: false };
    target = { x: 8, y: 153, z: 603 };
    simSeconds = 0.8;
  } else {
    // Cover: on final for runway 09, the strip ahead, gear down, HUD lit.
    // Aligned with the centreline, a shallow descent toward the runway.
    kind = MISSION_RINGS;
    passed = 0;
    pose = { x: 500, y: 110, z: 0, heading: Math.PI * 1.5, pitch: -0.03, speed: 42, throttle: 0.5, gearDown: true };
    target = { x: 0, y: 85, z: 0 };
    simSeconds = 1.5;
  }

  const flight = createFlight(terrain);
  placeFlight(flight, pose);
  const mission = createMission(kind, seed, terrain);
  for (let i = 0; i < passed; i += 1) {
    mission.targets[i].passed = true;
    mission.targets[i].mesh.material.opacity = 0.25;
    mission.passed += 1;
    mission.score += 100;
  }
  mission.nextIndex = passed;
  game.flight = flight;
  game.mission = mission;

  // Fly forward briefly under the autopilot so the propeller spins, the
  // clouds drift and the plane settles into its pose.
  for (let i = 0; i < simSeconds / STEP; i += 1) {
    stepFlight(flight, autopilotControls(flight, target), STEP);
    updateMission(mission, flight, terrain);
    if (flight.crashed || flight.landed) break;
  }
  return { screen: 'play', mission };
}
