// Daily login reward. 7-day cycle that loops; consecutive days build a
// streak, missing a day resets to Day 1. Persisted to @capacitor/preferences
// so the streak survives reinstalls (within the same OS keystore lifetime).

import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'slot-machine:daily-reward';

/**
 * Reward amounts per day in the 7-day cycle. Cycle repeats once a player
 * passes Day 7 — Day 8 reads back to Day 1's reward, etc. Tuned so the
 * 7th-day pop is satisfying without breaking the early-game economy.
 */
export const DAILY_REWARDS = [100, 200, 400, 600, 1000, 1500, 3000] as const;

interface PersistedState {
  lastClaimDate: string;
  streak: number;
}

export interface DailyStatus {
  /** Today's reward is unclaimed (or no claim yet ever). */
  available: boolean;
  /** What `streak` will become if `claim()` is called now. */
  newStreak: number;
  /** 0-indexed slot in the 7-day cycle (`newStreak - 1) % 7`). */
  dayInCycle: number;
  /** Reward amount that would be granted by `claim()`. */
  amount: number;
  /** True if the previous claim date is more than 1 day ago (and not first run). */
  streakBroken: boolean;
  /** Days since the last claim (Infinity if first run). */
  daysSinceLastClaim: number;
}

/**
 * "Today" key in the player's local timezone. Date math by string comparison
 * means we never have to chase JS Date subtraction edge cases.
 */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(prev: string, today: string): number {
  if (!prev) return Infinity;
  const [py, pm, pd] = prev.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const prevDate = new Date(py, pm - 1, pd);
  const todayDate = new Date(ty, tm - 1, td);
  const ms = todayDate.getTime() - prevDate.getTime();
  return Math.round(ms / 86_400_000);
}

class DailyRewardImpl {
  private state: PersistedState = { lastClaimDate: '', streak: 0 };
  private loaded = false;
  /** Test seam — overridden in unit tests. */
  private nowProvider: () => Date = () => new Date();

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        const parsed = JSON.parse(value) as Partial<PersistedState>;
        if (typeof parsed.lastClaimDate === 'string' && typeof parsed.streak === 'number') {
          this.state = {
            lastClaimDate: parsed.lastClaimDate,
            streak: Math.max(0, Math.floor(parsed.streak)),
          };
        }
      }
    } catch {
      /* preferences unavailable — keep defaults */
    }
    this.loaded = true;
  }

  /** Inspect what would happen on `claim()` without mutating state. */
  status(): DailyStatus {
    const today = dateKey(this.nowProvider());
    const days = daysBetween(this.state.lastClaimDate, today);
    if (days === 0) {
      // Already claimed today — show the just-completed slot for the UI.
      const dayInCycle = ((this.state.streak - 1) % 7 + 7) % 7;
      return {
        available: false,
        newStreak: this.state.streak,
        dayInCycle,
        amount: DAILY_REWARDS[dayInCycle],
        streakBroken: false,
        daysSinceLastClaim: 0,
      };
    }
    const isFirstClaim = this.state.lastClaimDate === '';
    const continued = days === 1;
    const newStreak = continued ? this.state.streak + 1 : 1;
    const dayInCycle = (newStreak - 1) % 7;
    return {
      available: true,
      newStreak,
      dayInCycle,
      amount: DAILY_REWARDS[dayInCycle],
      streakBroken: !isFirstClaim && !continued,
      daysSinceLastClaim: days,
    };
  }

  /** Grant the reward. Returns 0 if not currently available. */
  claim(): number {
    const s = this.status();
    if (!s.available) return 0;
    this.state = {
      lastClaimDate: dateKey(this.nowProvider()),
      streak: s.newStreak,
    };
    this.persistSoon();
    return s.amount;
  }

  /** Current persisted streak (0 before any claim). */
  getStreak(): number {
    return this.state.streak;
  }

  // ---------- test hooks ----------

  /** Test-only: override the system clock. */
  _setNowProvider(fn: () => Date): void {
    this.nowProvider = fn;
  }

  /** Test-only: wipe all persisted progress. */
  _reset(): void {
    this.state = { lastClaimDate: '', streak: 0 };
    this.persistSoon();
  }

  private writeTimer?: ReturnType<typeof setTimeout>;
  private persistSoon(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      this.writeTimer = undefined;
      void Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(this.state) });
    }, 100);
  }
}

export const dailyReward = new DailyRewardImpl();
export const loadDailyReward = (): Promise<void> => dailyReward.load();
