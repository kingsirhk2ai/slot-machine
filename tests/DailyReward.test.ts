import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: store.has(key) ? store.get(key)! : null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      store.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      store.delete(key);
    }),
  },
}));

async function freshDaily() {
  vi.resetModules();
  return import('../src/systems/DailyReward');
}

function dateAt(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12, 0, 0);
}

describe('DailyReward', () => {
  beforeEach(() => {
    store.clear();
  });

  it('available on first run with Day 1 reward', async () => {
    const { dailyReward, loadDailyReward, DAILY_REWARDS } = await freshDaily();
    await loadDailyReward();
    dailyReward._setNowProvider(() => dateAt(2026, 1, 15));
    const s = dailyReward.status();
    expect(s.available).toBe(true);
    expect(s.newStreak).toBe(1);
    expect(s.dayInCycle).toBe(0);
    expect(s.amount).toBe(DAILY_REWARDS[0]);
    expect(s.streakBroken).toBe(false);
  });

  it('claim returns the reward amount and marks day complete', async () => {
    const { dailyReward, loadDailyReward, DAILY_REWARDS } = await freshDaily();
    await loadDailyReward();
    dailyReward._setNowProvider(() => dateAt(2026, 1, 15));
    expect(dailyReward.claim()).toBe(DAILY_REWARDS[0]);
    expect(dailyReward.status().available).toBe(false);
    expect(dailyReward.getStreak()).toBe(1);
    // Second claim same day → 0.
    expect(dailyReward.claim()).toBe(0);
  });

  it('streak advances on consecutive days', async () => {
    const { dailyReward, loadDailyReward, DAILY_REWARDS } = await freshDaily();
    await loadDailyReward();
    let day = 1;
    dailyReward._setNowProvider(() => dateAt(2026, 1, day));
    for (let i = 0; i < 5; i++) {
      const got = dailyReward.claim();
      expect(got).toBe(DAILY_REWARDS[i]);
      day++;
    }
    expect(dailyReward.getStreak()).toBe(5);
  });

  it('skipping a day resets the streak', async () => {
    const { dailyReward, loadDailyReward, DAILY_REWARDS } = await freshDaily();
    await loadDailyReward();
    let day = 10;
    dailyReward._setNowProvider(() => dateAt(2026, 1, day));
    dailyReward.claim(); // Day 1 of streak
    day = 12; // skipped day 11
    const s = dailyReward.status();
    expect(s.streakBroken).toBe(true);
    expect(s.newStreak).toBe(1);
    expect(s.amount).toBe(DAILY_REWARDS[0]);
  });

  it('cycle wraps after 7 days back to Day 1 reward', async () => {
    const { dailyReward, loadDailyReward, DAILY_REWARDS } = await freshDaily();
    await loadDailyReward();
    let day = 1;
    dailyReward._setNowProvider(() => dateAt(2026, 1, day));
    for (let i = 0; i < 7; i++) {
      dailyReward.claim();
      day++;
    }
    expect(dailyReward.getStreak()).toBe(7);
    // Day 8: streak continues but reward cycles.
    const s = dailyReward.status();
    expect(s.newStreak).toBe(8);
    expect(s.dayInCycle).toBe(0);
    expect(s.amount).toBe(DAILY_REWARDS[0]);
  });

  it('persists last claim + streak across reload', async () => {
    {
      const { dailyReward, loadDailyReward } = await freshDaily();
      await loadDailyReward();
      dailyReward._setNowProvider(() => dateAt(2026, 2, 1));
      dailyReward.claim();
      dailyReward._setNowProvider(() => dateAt(2026, 2, 2));
      dailyReward.claim();
      await new Promise((r) => setTimeout(r, 150));
    }
    const { dailyReward, loadDailyReward } = await freshDaily();
    await loadDailyReward();
    dailyReward._setNowProvider(() => dateAt(2026, 2, 2)); // same day as last claim
    expect(dailyReward.getStreak()).toBe(2);
    expect(dailyReward.status().available).toBe(false);
  });

  it('streakBroken is false when this is the very first claim', async () => {
    const { dailyReward, loadDailyReward } = await freshDaily();
    await loadDailyReward();
    dailyReward._setNowProvider(() => dateAt(2026, 1, 1));
    expect(dailyReward.status().streakBroken).toBe(false);
  });
});
