/**
 * Seedable randomness (AD-6). Domain and services receive an Rng; nothing calls
 * Math.random. sfc32 is small, fast and deterministic across platforms.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, maxExclusive), like UnityEngine.Random.Range(int, int). */
  rangeInt(min: number, maxExclusive: number): number;
  /** Uniform 32-bit unsigned integer. */
  nextUint32(): number;
  /** Serializable internal state, so a save or sim can resume the same sequence. */
  state(): [number, number, number, number];
}

export function createRng(seed: number | [number, number, number, number]): Rng {
  let [a, b, c, d] = Array.isArray(seed) ? seed : seedState(seed);

  function nextUint32(): number {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  }

  return {
    nextUint32,
    next: () => nextUint32() / 4294967296,
    rangeInt(min: number, maxExclusive: number): number {
      if (maxExclusive <= min) return min;
      return min + Math.floor((nextUint32() / 4294967296) * (maxExclusive - min));
    },
    state: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
  };
}

/** splitmix32 expansion of a single seed into sfc32 state, then a short warm-up. */
function seedState(seed: number): [number, number, number, number] {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  const state: [number, number, number, number] = [next(), next(), next(), next()];
  const warm = createRng(state);
  for (let i = 0; i < 12; i++) warm.nextUint32();
  return warm.state();
}

/** UUIDv4 (lower-case) drawn from the Rng: the IdGenerator for clientEventId (AD-6). */
export function uuidV4(rng: Rng): string {
  const bytes: number[] = [];
  for (let i = 0; i < 4; i++) {
    const u = rng.nextUint32();
    bytes.push(u >>> 24, (u >>> 16) & 0xff, (u >>> 8) & 0xff, u & 0xff);
  }
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
