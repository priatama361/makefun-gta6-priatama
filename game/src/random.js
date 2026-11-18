// A seeded 32-bit generator so a seed always rebuilds the same city and the
// same staged screenshot scene, while a fresh seed gives a new playthrough.

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one entry from a list without pulling in any array helper that could
// hide the random call order from the deterministic staging code.
export function pick(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}
