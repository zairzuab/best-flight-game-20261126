// The three missions, each a different way to fly the valley: rings in order,
// low gates along the river, or one precise landing. Missions own their rings
// and gates as meshes, track progress and score the sortie.
import * as THREE from 'three';
import { RUNWAY, PALETTE } from './config.js';
import { riverX } from './terrain.js';
import { createRandom } from './random.js';

export const MISSION_RINGS = 'rings';
export const MISSION_CANYON = 'canyon';
export const MISSION_LANDING = 'landing';

export const MISSION_INFO = {
  [MISSION_RINGS]: {
    name: 'Ring Run',
    blurb: 'Fly through 8 glowing rings in order over the valley.',
    goal: 'Rings 0/8',
  },
  [MISSION_CANYON]: {
    name: 'Canyon Run',
    blurb: 'Thread 6 low gates along the river — stay under 60 m.',
    goal: 'Gates 0/6',
  },
  [MISSION_LANDING]: {
    name: 'Precision Landing',
    blurb: 'Land on runway 09 inside the touchdown zone, soft and centred.',
    goal: 'Land on the runway',
  },
};

function ringMesh(radius, color, opacity) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 1.1, 10, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
  );
  return mesh;
}

function buildRings(seed, terrain) {
  // A course over the valley: out over the lake, down the river, back to the field.
  const waypoints = [
    [-350, 150, -350],
    [-700, 130, -750],
    [-950, 110, -400],
    [-520, 90, 100],
    [-100, 140, 500],
    [350, 120, 300],
    [650, 100, -150],
    [300, 90, -450],
  ];
  const group = new THREE.Group();
  const rings = waypoints.map(([x, y, z], i) => {
    const ground = terrain.heightAt(x, z);
    const mesh = ringMesh(14, PALETTE.ring, 0.55);
    mesh.position.set(x, Math.max(y, ground + 55), z);
    // Face the ring toward the previous waypoint so the plane flies through it.
    const prev = waypoints[(i + waypoints.length - 1) % waypoints.length];
    mesh.lookAt(prev[0], mesh.position.y, prev[2]);
    mesh.userData.index = i;
    group.add(mesh);
    return { mesh, x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, passed: false };
  });
  return { group, rings };
}

function buildGates(seed, terrain) {
  // Six gates hugging the river, low over the water.
  const group = new THREE.Group();
  const gates = [];
  const zs = [-1400, -950, -500, -50, 400, 850];
  zs.forEach((z, i) => {
    const x = riverX(z);
    const ground = terrain.heightAt(x, z);
    const mesh = ringMesh(12, PALETTE.gate, 0.55);
    mesh.position.set(x, ground + 26, z);
    // The river runs north-south, so the gate's opening faces north-south
    // (the torus's default plane) — the plane flies through it face-on.
    mesh.userData.index = i;
    group.add(mesh);
    gates.push({ mesh, x, y: mesh.position.y, z, passed: false });
  });
  return { group, gates };
}

/** Build a mission: its meshes, its targets and its score state. */
export function createMission(kind, seed, terrain) {
  const group = new THREE.Group();
  let targets = [];
  if (kind === MISSION_RINGS) {
    const built = buildRings(seed, terrain);
    group.add(built.group);
    targets = built.rings;
  } else if (kind === MISSION_CANYON) {
    const built = buildGates(seed, terrain);
    group.add(built.group);
    targets = built.gates;
  }
  const info = MISSION_INFO[kind];
  return {
    kind,
    info,
    group,
    targets,
    nextIndex: 0,
    passed: 0,
    score: 0,
    time: 0,
    complete: false,
    // Where the plane starts for this mission.
    startPose() {
      if (kind === MISSION_CANYON) {
        // Start north of the first gate and fly south down the river,
        // through the gates in order (their z grows southward).
        return {
          x: riverX(-1650), y: 90, z: -1650, heading: Math.PI, pitch: 0,
          speed: 48, throttle: 0.6, gearDown: false,
        };
      }
      if (kind === MISSION_LANDING) {
        return {
          x: 1400, y: 260, z: 420, heading: Math.PI * 1.5, pitch: -0.06,
          speed: 52, throttle: 0.42, gearDown: true,
        };
      }
      return {
        x: -650, y: 190, z: -150, heading: Math.PI * 0.25, pitch: 0,
        speed: 46, throttle: 0.6, gearDown: false,
      };
    },
  };
}

/**
 * Check the plane against the next target. A target counts when the plane
 * crosses its plane within its radius. Returns 'passed', 'complete' or null.
 * For the canyon, passing above 60 m over the ground does not count.
 */
export function updateMission(mission, flight, terrain) {
  mission.time += 1 / 60;
  if (mission.complete || mission.targets.length === 0) return null;
  const target = mission.targets[mission.nextIndex];
  if (!target || target.passed) return null;
  // The ring faces the course; its normal is its local Z axis.
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(target.mesh.quaternion);
  const toPlane = new THREE.Vector3(flight.x - target.x, flight.y - target.y, flight.z - target.z);
  const along = toPlane.dot(normal);
  const radial = Math.hypot(toPlane.length() ** 2 - along * along, 0);
  // Crossing detected when the plane is within the disc and close to the plane.
  if (Math.abs(along) < 6 && radial < 13) {
    if (mission.kind === MISSION_CANYON) {
      const agl = flight.y - terrain.heightAt(flight.x, flight.z);
      if (agl > 60) return null; // too high for a canyon gate
    }
    target.passed = true;
    mission.passed += 1;
    mission.score += 100;
    mission.nextIndex += 1;
    target.mesh.material.color.setHex(0xffffff);
    target.mesh.material.opacity = 0.25;
    if (mission.nextIndex >= mission.targets.length) {
      mission.complete = true;
      mission.score += 250; // course bonus
      return 'complete';
    }
    return 'passed';
  }
  return null;
}

/** Highlight the next target and dim the rest, so the pilot always knows where to go. */
export function highlightNext(mission, time) {
  mission.targets.forEach((target, i) => {
    if (target.passed) return;
    const isNext = i === mission.nextIndex;
    const mat = target.mesh.material;
    if (isNext) {
      mat.opacity = 0.65 + 0.3 * Math.sin(time * 4);
      target.mesh.scale.setScalar(1 + 0.04 * Math.sin(time * 4));
    } else {
      mat.opacity = 0.4;
      target.mesh.scale.setScalar(1);
    }
  });
}

/**
 * Score a precision landing: soft, centred, on speed. Called once at touchdown.
 * Returns the points and a breakdown for the results screen.
 */
export function scoreLanding(flight) {
  const centreError = Math.abs(flight.z - RUNWAY.z);
  const zoneError = Math.max(0, Math.abs(flight.x - RUNWAY.touchdownX) - 100) / 10;
  const softness = Math.min(100, Math.max(0, 100 - Math.abs(flight.vspeed) * 22));
  const centre = Math.min(100, Math.max(0, 100 - centreError * 4 - zoneError));
  const speed = Math.min(100, Math.max(0, 100 - Math.abs(flight.speed - 30) * 2.5));
  const total = Math.round(softness * 0.45 + centre * 0.35 + speed * 0.2);
  return {
    total,
    softness: Math.round(softness),
    centre: Math.round(centre),
    speed: Math.round(speed),
    centreErrorM: Math.round(centreError),
    vspeed: flight.vspeed.toFixed(1),
  };
}
