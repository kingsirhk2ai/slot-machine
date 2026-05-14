const STORAGE_KEY = 'slot-game-prefs';

interface GamePrefs {
  quickSpin: boolean;
}

const DEFAULT: GamePrefs = { quickSpin: false };

type Listener = () => void;

class SettingsImpl {
  private prefs: GamePrefs;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.prefs = this.load();
  }

  isQuickSpin(): boolean {
    return this.prefs.quickSpin;
  }

  setQuickSpin(v: boolean): void {
    if (this.prefs.quickSpin === v) return;
    this.prefs.quickSpin = v;
    this.save();
    this.notify();
  }

  /** Subscribe to setting changes. Returns an unsubscribe fn. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private load(): GamePrefs {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT };
      const p = JSON.parse(raw);
      return {
        quickSpin: typeof p.quickSpin === 'boolean' ? p.quickSpin : DEFAULT.quickSpin,
      };
    } catch {
      return { ...DEFAULT };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // storage unavailable — fall back to in-memory only
    }
  }
}

export const settings = new SettingsImpl();

/**
 * In-memory session counters. Reset on page reload — these intentionally
 * do NOT persist, so each session feels fresh. Useful for "how am I doing
 * this session?" feedback in the Settings drawer.
 */
class SessionStatsImpl {
  spins = 0;
  wagered = 0;
  won = 0;
  bestWin = 0;
  freeSpinsTriggered = 0;
  private listeners: Set<Listener> = new Set();

  record(bet: number, win: number): void {
    this.spins++;
    this.wagered += bet;
    this.won += win;
    if (win > this.bestWin) this.bestWin = win;
    this.notify();
  }

  recordFreeSpinsTrigger(): void {
    this.freeSpinsTriggered++;
    this.notify();
  }

  reset(): void {
    this.spins = 0;
    this.wagered = 0;
    this.won = 0;
    this.bestWin = 0;
    this.freeSpinsTriggered = 0;
    this.notify();
  }

  net(): number {
    return this.won - this.wagered;
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const sessionStats = new SessionStatsImpl();
