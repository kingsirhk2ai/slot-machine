// 5 reel strips. Weight profile per strip (approximate):
//   low (10/J/Q/K/A) ~14, CHERRY ~2, LEMON ~2, STAR ~1-2, SEVEN ~1, WILD ~1, SCATTER ~1
// Each strip is ~22 entries. Hand-tuned for variety; ids must match SYMBOLS in symbols.ts.

export const REEL_STRIPS: readonly (readonly string[])[] = [
  // Reel 0 — leftmost, slightly more lows
  [
    '10', 'J', 'CHERRY', 'Q', 'K', 'A', '10', 'LEMON', 'J', 'Q',
    'STAR', 'K', 'A', '10', 'WILD', 'J', 'Q', 'SEVEN', 'K', 'A',
    'SCATTER', 'CHERRY',
  ],
  // Reel 1
  [
    'J', 'Q', '10', 'LEMON', 'K', 'A', 'CHERRY', 'J', 'Q', 'K',
    '10', 'STAR', 'A', 'J', 'SEVEN', 'Q', 'WILD', 'K', 'A', '10',
    'LEMON', 'SCATTER',
  ],
  // Reel 2 — middle, slightly more highs (more action visible to player)
  [
    'Q', 'K', 'CHERRY', '10', 'J', 'A', 'STAR', 'Q', 'K', '10',
    'SEVEN', 'J', 'A', 'WILD', 'Q', 'LEMON', 'K', '10', 'CHERRY', 'J',
    'A', 'SCATTER',
  ],
  // Reel 3
  [
    'K', 'A', '10', 'J', 'LEMON', 'Q', 'K', 'STAR', 'A', '10',
    'CHERRY', 'J', 'Q', 'SEVEN', 'K', 'WILD', 'A', '10', 'J', 'Q',
    'CHERRY', 'SCATTER',
  ],
  // Reel 4 — rightmost
  [
    'A', '10', 'J', 'Q', 'CHERRY', 'K', 'A', '10', 'LEMON', 'J',
    'Q', 'K', 'STAR', 'A', '10', 'WILD', 'J', 'SEVEN', 'Q', 'K',
    'CHERRY', 'SCATTER',
  ],
] as const;
