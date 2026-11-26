// The flight model: a light single-prop plane with lift that needs speed, a
// stall below it, throttle, drag, gravity, fuel burn and damage. It knows
// nothing about rendering or missions — it only moves a state forward.
import { FLIGHT, RUNWAY } from './config.js';
import { clamp } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_CRASHED = 1;
export const EVENT_LANDED = 2;
export const EVENT_FUEL_EMPTY = 4;

/** Forward unit vector from heading (rad, 0 = north, clockwise) and pitch. */
export function forwardVector(heading, pitch) {
  return {
    x: Math.sin(heading) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(heading) * Math.cos(pitch),
  };
}

/** Fresh flight state, sitting on the runway threshold ready for takeoff. */
export function createFlight(terrain) {
  return {
    x: RUNWAY.x - RUNWAY.length / 2 + 60,
    y: RUNWAY.elevation + 1.6,
    z: RUNWAY.z,
    heading: Math.PI / 2, // east, down the runway
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: FLIGHT.startFuel,
    damage: 0,
    vspeed: 0,
    gearDown: true,
    airbrake: false,
    stalled: false,
    crashed: false,
    landed: false,
    onGround: true,
    crashReason: '',
    terrain,
  };
}

/** Put the plane somewhere for a screenshot or a mission start. */
export function placeFlight(state, pose) {
  state.x = pose.x;
  state.y = pose.y;
  state.z = pose.z;
  state.heading = pose.heading;
  state.pitch = pose.pitch ?? 0;
  state.roll = pose.roll ?? 0;
  state.speed = pose.speed ?? FLIGHT.startSpeed;
  state.throttle = pose.throttle ?? 0.55;
  state.gearDown = pose.gearDown ?? true;
  state.crashed = false;
  state.landed = false;
  state.onGround = false;
  state.crashReason = '';
  state.stalled = false;
}

/**
 * Advance the flight model by dt seconds. `controls` carries pitch, roll,
 * rudder (-1..1), throttleDelta, airbrake and gearToggle. Returns an event mask.
 */
export function stepFlight(state, controls, dt) {
  if (state.crashed || state.landed) return EVENT_NONE;
  const terrain = state.terrain;

  // Throttle: W/S nudge it; fuel empty forces idle.
  state.throttle = clamp(state.throttle + controls.throttleDelta * dt, 0, 1);
  if (state.fuel <= 0) state.throttle = 0;
  if (controls.gearToggle) state.gearDown = !state.gearDown;
  state.airbrake = controls.airbrake;

  // Control authority fades near the stall and on the ground.
  const stalled = state.speed < FLIGHT.stallSpeed && !state.onGround;
  state.stalled = stalled;
  const authority = state.onGround ? 0.15 : stalled ? 0.3 : 1;

  // Pitch and roll, with a gentle auto-level when the stick is centred.
  state.pitch = clamp(state.pitch + controls.pitch * FLIGHT.pitchRate * authority * dt, -FLIGHT.maxPitch, FLIGHT.maxPitch);
  state.roll = clamp(state.roll + controls.roll * FLIGHT.rollRate * authority * dt, -FLIGHT.maxRoll, FLIGHT.maxRoll);
  if (Math.abs(controls.roll) < 0.05) state.roll *= Math.max(0, 1 - 0.8 * dt);
  if (Math.abs(controls.pitch) < 0.05 && !stalled) state.pitch *= Math.max(0, 1 - 0.25 * dt);
  // A stalled wing drops the nose.
  if (stalled) state.pitch = Math.max(state.pitch - 0.5 * dt, -0.45);
  // Banked turns turn the plane; the rudder yaws it directly.
  state.heading += (-state.roll * 0.35 + controls.rudder * FLIGHT.rudderRate * authority) * dt;

  // Speed: thrust along the nose, drag, and gravity's pull along the flight path.
  const thrust = state.throttle * FLIGHT.thrustAccel;
  const drag = FLIGHT.dragK * state.speed * state.speed + (state.airbrake ? FLIGHT.airbrakeK * state.speed * state.speed : 0);
  const gravityAlongPath = -FLIGHT.gravity * Math.sin(state.pitch);
  state.speed = clamp(state.speed + (thrust - drag + gravityAlongPath) * dt, 0, FLIGHT.maxSpeed);

  // Move along the forward vector; a stalled wing also sinks.
  const fwd = forwardVector(state.heading, state.pitch);
  let sink = 0;
  if (stalled) sink = (FLIGHT.stallSpeed - state.speed) * 0.55;
  const prevY = state.y;
  state.x += fwd.x * state.speed * dt;
  state.y += (fwd.y * state.speed - sink) * dt;
  state.z += fwd.z * state.speed * dt;
  state.vspeed = (state.y - prevY) / dt;

  // Fuel burns with the throttle.
  const burn = FLIGHT.fuelBurnIdle + state.throttle * (FLIGHT.fuelBurnFull - FLIGHT.fuelBurnIdle);
  state.fuel = Math.max(0, state.fuel - burn * dt);

  // Ground contact.
  const ground = terrain.heightAt(state.x, state.z);
  const clearance = state.y - ground;
  const overWater = terrain.isOverWater(state.x, state.z) && clearance < 1.5;
  if (overWater) {
    state.crashed = true;
    state.crashReason = 'Ditched in the water';
    state.damage = 100;
    return EVENT_CRASHED;
  }
  if (state.onGround) {
    // Rolling: stay on the ground until the wing lifts the plane off.
    state.y = ground + 1.6;
    if (state.speed >= FLIGHT.stallSpeed && state.pitch > 0.05) {
      state.onGround = false; // liftoff
    } else {
      state.pitch = 0;
      state.roll = 0;
      if (state.throttle < 0.1) state.speed = Math.max(0, state.speed - 10 * dt);
      if (state.speed < 0.5 && state.throttle < 0.1) {
        state.landed = true;
        return EVENT_LANDED;
      }
      return state.fuel <= 0 ? EVENT_FUEL_EMPTY : EVENT_NONE;
    }
  }
  if (clearance <= 1.6) {
    if (state.vspeed >= -0.5) {
      // Skimming the ground: hold just above it, no landing, no crash.
      state.y = ground + 1.6;
      return state.fuel <= 0 ? EVENT_FUEL_EMPTY : EVENT_NONE;
    }
    const onRunway = terrain.isOnRunway(state.x, state.z);
    const gentle = Math.abs(state.vspeed) <= FLIGHT.landingMaxVs && state.speed <= FLIGHT.landingMaxSpeed;
    if (state.gearDown && gentle) {
      // Touchdown: roll out, on the runway or on flat grass.
      state.y = ground + 1.6;
      state.onGround = true;
      state.pitch = 0;
      state.roll = 0;
      state.speed = Math.max(0, state.speed - 14 * dt);
      if (state.speed < 2) {
        state.landed = true;
        return EVENT_LANDED;
      }
      return EVENT_NONE;
    }
    if (clearance <= 0.6) {
      // Hard contact with the ground.
      const impact = Math.abs(state.vspeed) + state.speed * 0.12;
      state.damage = Math.min(100, state.damage + impact * 9);
      state.crashed = true;
      state.crashReason = onRunway && !state.gearDown
        ? 'Belly landing — gear was up'
        : Math.abs(state.vspeed) > FLIGHT.crashMaxVs
          ? 'Hit the ground too hard'
          : 'Crashed into terrain';
      return EVENT_CRASHED;
    }
  }
  return state.fuel <= 0 ? EVENT_FUEL_EMPTY : EVENT_NONE;
}

/** Readouts the HUD shows, in pilot units. */
export function flightReadouts(state) {
  return {
    altitudeFt: Math.round((state.y - RUNWAY.elevation) * 3.28084),
    airspeedKts: Math.round(state.speed * 1.94384),
    headingDeg: Math.round(((state.heading * 180) / Math.PI % 360 + 360) % 360),
    verticalFpm: Math.round(state.vspeed * 196.85),
    throttlePct: Math.round(state.throttle * 100),
    fuelPct: Math.round(state.fuel),
    damagePct: Math.round(state.damage),
  };
}
