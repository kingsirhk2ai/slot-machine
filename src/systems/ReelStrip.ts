import type { RNG } from './RNG';

export class ReelStrip {
  constructor(private readonly strip: readonly string[]) {
    if (strip.length === 0) throw new Error('ReelStrip: empty strip');
  }

  get length(): number {
    return this.strip.length;
  }

  getSymbolAt(index: number): string {
    const n = this.strip.length;
    const i = ((index % n) + n) % n;
    return this.strip[i];
  }

  pickStopIndex(rng: RNG): number {
    return rng.rollInt(0, this.length - 1);
  }
}
