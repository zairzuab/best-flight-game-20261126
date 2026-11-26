// Skyward Valley's ground: a seeded heightfield with a river, a lake, a runway
// flattened into the valley floor, a town, distant mountains and drifting clouds.
// heightAt is the single source of truth for the ground: the mesh, the flight
// model and the missions all read it, so what you see is what you fly over.
import * as THREE from 'three';
import { WORLD, RUNWAY, PALETTE } from './config.js';
import { fbm, valueNoise, smoothstep, lerp, createRandom } from './random.js';

/** The river's centreline: it meanders north-south through the west of the valley. */
export function riverX(z) {
  return -520 + 130 * Math.sin(z * 0.0011) + 55 * Math.sin(z * 0.0029 + 1.7);
}

const LAKE = { x: -900, z: -800, radius: 280 };

/**
 * Ground height at (x, z): rolling hills, mountains at the rim, a river channel
 * and a lake carved down to water level, and the runway pad flattened to 12 m.
 */
export function heightAt(x, z, seed) {
  let h = fbm(x * 0.0011, z * 0.0011, seed, 4) * 70;
  h += fbm(x * 0.00023, z * 0.00023, seed + 50, 2) * 130;
  const dist = Math.hypot(x, z);
  const mountain = smoothstep(1500, 2000, dist) * 330;
  h += mountain * (0.65 + 0.7 * fbm(x * 0.0004 + 7, z * 0.0004 - 3, seed + 9, 3));
  // Carve the river channel down to water level.
  const riverDist = Math.abs(x - riverX(z));
  h = lerp(4, h, smoothstep(18, 95, riverDist));
  // Carve the lake.
  const lakeDist = Math.hypot(x - LAKE.x, z - LAKE.z);
  h = lerp(4, h, smoothstep(70, 320, lakeDist));
  // Flatten the runway pad.
  const dx = Math.max(Math.abs(x - RUNWAY.x) - RUNWAY.length / 2, 0);
  const dz = Math.max(Math.abs(z - RUNWAY.z) - RUNWAY.width / 2, 0);
  const padDist = Math.hypot(dx, dz);
  h = lerp(RUNWAY.elevation, h, smoothstep(0, 130, padDist));
  return h;
}

function groundColor(x, z, h, seed, color) {
  const n = valueNoise(x * 0.02, z * 0.02, seed + 77);
  if (h < 6.5) {
    color.setHex(PALETTE.sand);
  } else if (h > 240) {
    // High ground: rock with patchy snow, never a solid white wall.
    const snowMix = smoothstep(240, 330, h) * (0.35 + 0.65 * n);
    color.setHex(PALETTE.rock).lerp(new THREE.Color(PALETTE.snow), snowMix);
  } else {
    color.setHex(PALETTE.grass).lerp(new THREE.Color(PALETTE.grassDry), n * 0.7);
  }
  // A little variation so the hills read as fields, not flat paint.
  const shade = 0.92 + n * 0.16;
  color.multiplyScalar(shade);
  return color;
}

function buildGround(seed) {
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z, seed);
    pos.setY(i, h);
    groundColor(x, z, h, seed, color);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(geo, mat);
}

function buildRiver(seed) {
  const group = new THREE.Group();
  const waterMat = new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.88 });
  // A ribbon of quads following the river's meander, at water level.
  const positions = [];
  const indices = [];
  const step = 80;
  let row = 0;
  for (let z = -WORLD.half; z <= WORLD.half; z += step, row += 1) {
    const cx = riverX(z);
    positions.push(cx - 34, 4.6, z, cx + 34, 4.6, z);
    if (row > 0) {
      const a = (row - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, waterMat));
  // The lake.
  const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.radius, 40), waterMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(LAKE.x, 4.6, LAKE.z);
  group.add(lake);
  return group;
}

function buildRunway(seed) {
  const group = new THREE.Group();
  const y = RUNWAY.elevation;
  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.length, 0.6, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
  );
  asphalt.position.set(RUNWAY.x, y + 0.3, RUNWAY.z);
  group.add(asphalt);
  // Centreline dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  for (let x = -260; x <= 260; x += 40) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 1.6), dashMat);
    dash.position.set(x, y + 0.66, RUNWAY.z);
    group.add(dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 4), dashMat);
      bar.position.set(end * 282, y + 0.66, RUNWAY.z + k * 5);
      group.add(bar);
    }
  }
  // Edge lights: warm glowing studs down both sides.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let x = -290; x <= 290; x += 58) {
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), lightMat);
      light.position.set(x, y + 1.1, RUNWAY.z + side * (RUNWAY.width / 2 + 2));
      group.add(light);
    }
  }
  // Windsock beside the eastern threshold.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.set(240, y + 4.5, 48);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 6, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(237, y + 8.6, 48);
  group.add(sock);
  return group;
}

function buildTown(seed) {
  const group = new THREE.Group();
  const rng = createRandom(seed + 31);
  const wallColors = [0xe8dcc8, 0xdfe8f0, 0xf0e0c8, 0xe0d0c0];
  const roofColors = [0xb5543a, 0x8a4a3a, 0x6a5a8a, 0x4a6a8a];
  for (let i = 0; i < 26; i += 1) {
    const x = 120 + rng.range(-140, 260);
    const z = 300 + rng.range(-90, 130);
    const w = rng.range(9, 15);
    const d = rng.range(8, 12);
    const h = rng.range(5, 9);
    const gy = heightAt(x, z, seed);
    const house = new THREE.Group();
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: rng.pick(wallColors) }),
    );
    walls.position.y = h / 2;
    house.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, rng.range(3, 5), 4),
      new THREE.MeshLambertMaterial({ color: rng.pick(roofColors) }),
    );
    roof.position.y = h + 1.8;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    house.position.set(x, gy, z);
    house.rotation.y = rng.range(0, Math.PI);
    group.add(house);
  }
  // Trees dotted around the town and the valley.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a34 });
  for (let i = 0; i < 46; i += 1) {
    const x = rng.range(-1400, 1400);
    const z = rng.range(-1400, 1400);
    if (Math.abs(x) < 360 && Math.abs(z) < 110) continue; // keep the runway clear
    if (Math.abs(x - riverX(z)) < 50) continue; // not in the river
    const gy = heightAt(x, z, seed);
    if (gy < 8) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 5), trunkMat);
    trunk.position.y = 2;
    tree.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(rng.range(2.5, 4), rng.range(7, 11), 6), leafMat);
    leaves.position.y = 7;
    tree.add(leaves);
    tree.position.set(x, gy, z);
    group.add(tree);
  }
  return group;
}

function buildMountains(seed) {
  const group = new THREE.Group();
  const rng = createRandom(seed + 57);
  const rockMat = new THREE.MeshLambertMaterial({ color: PALETTE.rock });
  const snowMat = new THREE.MeshLambertMaterial({ color: PALETTE.snow });
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const radius = rng.range(1720, 1980);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const h = rng.range(320, 480);
    const r = rng.range(230, 380);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rockMat);
    peak.position.set(x, h / 2 - 10, z);
    group.add(peak);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.34, 7), snowMat);
    cap.position.set(x, h - 10 - h * 0.17, z);
    group.add(cap);
  }
  return group;
}

function buildClouds(seed) {
  const group = new THREE.Group();
  const rng = createRandom(seed + 83);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    const puffs = rng.int(3, 5);
    for (let p = 0; p < puffs; p += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rng.range(18, 34), 10, 8), mat);
      s.scale.y = 0.38;
      s.position.set(rng.range(-40, 40), rng.range(-4, 6), rng.range(-16, 16));
      cloud.add(s);
    }
    cloud.position.set(rng.range(-1700, 1700), rng.range(300, 460), rng.range(-1700, 1700));
    cloud.userData.speed = rng.range(1.5, 4);
    group.add(cloud);
    clouds.push(cloud);
  }
  return { group, clouds };
}

/** Build the whole valley and return the group plus the ground queries. */
export function createTerrain(seed) {
  const group = new THREE.Group();
  group.add(buildGround(seed));
  group.add(buildRiver(seed));
  group.add(buildRunway(seed));
  group.add(buildTown(seed));
  group.add(buildMountains(seed));
  const clouds = buildClouds(seed);
  group.add(clouds.group);
  return {
    group,
    clouds: clouds.clouds,
    heightAt(x, z) {
      return heightAt(x, z, seed);
    },
    isOnRunway(x, z) {
      return Math.abs(x - RUNWAY.x) <= RUNWAY.length / 2 && Math.abs(z - RUNWAY.z) <= RUNWAY.width / 2;
    },
    isOverWater(x, z) {
      if (Math.abs(x - riverX(z)) < 32) return true;
      return Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius;
    },
    lake: LAKE,
  };
}
