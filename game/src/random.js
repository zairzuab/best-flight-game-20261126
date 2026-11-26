// A seeded random number generator and the value noise built on it, so the valley
// is the same every run for the same seed: terrain, town, clouds and missions all
// draw from here, never from Math.random.

/** Mulberry32: a small, fast seeded PRNG. */
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}

/** Deterministic 2D hash: the same (x, y, seed) always gives the same 0..1. */
function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in 0..1, bilinearly interpolated between hashed corners. */
export function valueNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  const u = smooth(fx);
  const v = smooth(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise: several octaves of value noise, normalised to roughly 0..1. */
export function fbm(x, y, seed, octaves) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * valueNoise(x * freq, y * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** Clamp helper used by the terrain carving. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Smoothstep helper: 0 below edge0, 1 above edge1, smooth between. */
export function smoothstep(edge0, edge1, v) {
  const t = clamp((v - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Linear interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
