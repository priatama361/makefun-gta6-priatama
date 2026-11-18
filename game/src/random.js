// A small seeded random number generator (mulberry32) plus a few helpers. The same seed always
// produces the same city and the same traffic, which is what makes the staged scenes repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  random.range = (low, high) => low + random() * (high - low);
  random.int = (low, high) => Math.floor(random.range(low, high + 1));
  random.pick = (list) => list[Math.floor(random() * list.length)];
  random.chance = (probability) => random() < probability;
  return random;
}

/** Clamp a number into an inclusive range. */
export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

/** Straight-line distance between two points. */
export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Shortest signed angular difference, in radians. */
export function angleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
