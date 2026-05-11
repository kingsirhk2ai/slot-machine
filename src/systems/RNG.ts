export interface IRNG {
  rollInt(min: number, max: number): number;
  pick<T>(arr: T[]): T;
}

export class RNG implements IRNG {
  private readonly seeded: boolean;
  private state: number;

  constructor(seed?: number) {
    if (typeof seed === 'number') {
      this.seeded = true;
      this.state = (seed >>> 0) || 1;
    } else {
      this.seeded = false;
      this.state = 0;
    }
  }

  rollInt(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    const range = hi - lo + 1;
    if (range <= 0) return lo;
    return lo + Math.floor(this.nextFloat() * range);
  }

  pick<T>(arr: T[]): T {
    if (arr.length === 0) throw new Error('RNG.pick: empty array');
    return arr[this.rollInt(0, arr.length - 1)];
  }

  private nextFloat(): number {
    if (this.seeded) {
      // Numerical Recipes LCG, m = 2^32
      this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
      return this.state / 0x100000000;
    }
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
}

export const rng = new RNG();
