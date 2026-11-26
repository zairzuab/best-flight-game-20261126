// Skyward Valley — the one place every tuning number lives: the world, the flight
// envelope and the palette. Nothing here imports anything else, so every other
// module can read it without a cycle.
export const WORLD = {
  size: 4000,
  half: 2000,
  seed: 1,
  // The valley floor the runway sits on.
  runwayElevation: 12,
};

export const RUNWAY = {
  // Runway 09/27 runs east-west through the middle of the valley.
  x: 0,
  z: 0,
  length: 600,
  width: 30,
  elevation: 12,
  // Touchdown zone: the first third of the runway from the east end.
  touchdownX: 150,
};

export const FLIGHT = {
  thrustAccel: 26, // m/s^2 at full throttle
  dragK: 0.0038, // drag = k * v^2
  airbrakeK: 0.022, // extra drag with the airbrake out
  stallSpeed: 26, // m/s: below this the wing stops flying
  maxSpeed: 95,
  pitchRate: 0.55, // rad/s at full elevator
  rollRate: 1.15, // rad/s at full aileron
  rudderRate: 0.28, // rad/s at full rudder
  maxPitch: 0.6,
  maxRoll: 1.25,
  gravity: 9.81,
  fuelBurnIdle: 0.03, // percent per second at idle
  fuelBurnFull: 0.28, // percent per second at full throttle
  startFuel: 100,
  startSpeed: 42,
  // A landing counts when the wheels touch inside these limits.
  landingMaxVs: 3.5, // m/s descent
  landingMaxSpeed: 45, // m/s
  crashMaxVs: 6, // m/s descent: harder than this is a crash anywhere
};

export const CAMERA = {
  chaseDistance: 15,
  chaseHeight: 4.5,
  lookAhead: 22,
  smoothing: 0.12,
};

export const PALETTE = {
  skyTop: 0x2f6fd0,
  skyHorizon: 0xcfe8f5,
  fog: 0xd7e6ef,
  grass: 0x5d9b4a,
  grassDry: 0x8aa653,
  rock: 0x8a7f72,
  snow: 0xf2f5f7,
  sand: 0xd9c08a,
  water: 0x2e7fb8,
  asphalt: 0x3a3f45,
  townRoof: 0xb5543a,
  townWall: 0xe8dcc8,
  ring: 0xffb020,
  gate: 0x35e08a,
};
