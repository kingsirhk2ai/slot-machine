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
