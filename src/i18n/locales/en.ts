// English source-of-truth strings. Keys are kebab-cased semantic identifiers.
// New strings: add here first, then translate in zh-HK.ts.
export const en = {
  // Core actions
  'spin': 'SPIN',
  'spinning': 'SPINNING',
  'stop': 'STOP',
  'max': 'MAX',
  'cancel': 'CANCEL',
  'reset': 'RESET',
  'on': 'ON',
  'off': 'OFF',
  'no-thanks': 'no thanks',
  'share': 'SHARE',

  // HUD
  'credit': 'CREDIT',
  'bet': 'BET',
  'lines': 'LINES',
  'total-bet': 'TOTAL BET',
  'win': 'WIN',
  'last': 'LAST',

  // Streak
  'streak': 'STREAK',

  // Win badges
  'win-badge': 'WIN',
  'mega-win': 'MEGA WIN',
  'big-win': 'BIG WIN',

  // Free spins
  'free-spins-banner': 'FREE SPINS!',
  'free-spins-complete': 'FREE SPINS COMPLETE',
  'total-plus': 'TOTAL +{n}',
  'scatter-trigger': '{count}× SCATTER  →  +{spins} SPINS',
  'free-spin-status': 'FREE SPIN  {used}/{total}   ×{mult}',
  'bonus-purchased': 'BONUS PURCHASED\n{spins} FREE SPINS',

  // Paytable
  'paytable': 'PAYTABLE',
  'paytable-symbol': 'SYMBOL',
  'paytable-x3': 'x3',
  'paytable-x4': 'x4',
  'paytable-x5': 'x5',
  'paytable-hint': 'Multipliers × per-line bet. Match left-to-right, 3+ in a row.',

  // Settings
  'settings': 'SETTINGS',
  'mute': 'MUTE',
  'sfx': 'SFX',
  'music': 'MUSIC',
  'quick-spin': 'QUICK SPIN',
  'gamble': 'GAMBLE',
  'this-session': 'THIS SESSION',
  'spins': 'SPINS',
  'wagered': 'WAGERED',
  'won': 'WON',
  'net': 'NET',
  'top-up': '+ TOP UP',
  'language': 'LANGUAGE',

  // Refill
  'out-of-credits': 'OUT OF CREDITS',
  'refill-broke': 'You ran out — grab a refill?',
  'refill-manual': 'Add {n} credits to your balance.',
  'refill-button': '+{n}  CREDITS',

  // Buy Bonus
  'buy-bonus': 'BUY BONUS',
  'buy-free-spins': 'BUY FREE SPINS',
  'free-spins-award': '{n} FREE SPINS',
  'with-multiplier': 'with ×2 win multiplier',
  'cost': 'COST',
  'balance': 'BALANCE',
  'buy-cta': 'BUY {cost}',
  'not-enough': 'NOT ENOUGH',

  // Gamble
  'double-or-nothing': 'DOUBLE OR NOTHING',
  'gamble-prompt': 'WIN  {win}  →  {doubled}?',
  'red': 'RED',
  'black': 'BLACK',
  'gamble-take': 'tap outside to take winnings',
  'gamble-win': '+{n}  WIN!',
  'gamble-bust': 'BUST',

  // Daily reward
  'daily-reward': 'DAILY REWARD',
  'daily-reward-sub': 'Log in daily to earn more!',
  'claim': 'CLAIM',
  'claim-amount': '+{n}',
  'come-back-tomorrow': 'Come back tomorrow for the next reward!',
  'streak-day': 'Day {n}',
  'streak-broken': 'Streak reset — starting from Day 1',
  'streak-current': 'Streak: {n} days',

  // Achievements
  'achievements': 'ACHIEVEMENTS',
  'achievement-unlocked': 'ACHIEVEMENT UNLOCKED!',
  'ach-locked': 'LOCKED',
  'ach-progress': '{n} / {total}',
  'ach-completed': '{n} / {total} unlocked',

  'ach-first-spin': 'First Spin',
  'ach-first-spin-desc': 'Take your first spin',
  'ach-veteran': 'Veteran',
  'ach-veteran-desc': 'Spin 100 times',
  'ach-spin-master': 'Spin Master',
  'ach-spin-master-desc': 'Spin 1000 times',
  'ach-big-winner': 'Big Winner',
  'ach-big-winner-desc': 'Win 500 in a single spin',
  'ach-mega-winner': 'Mega Winner',
  'ach-mega-winner-desc': 'Hit a MEGA WIN',
  'ach-lucky-streak': 'Lucky Streak',
  'ach-lucky-streak-desc': 'Win 5 spins in a row',
  'ach-hot-streak': 'Hot Streak',
  'ach-hot-streak-desc': 'Win 8 spins in a row',
  'ach-bonus-hunter': 'Bonus Hunter',
  'ach-bonus-hunter-desc': 'Trigger free spins',
  'ach-bonus-buyer': 'Bonus Buyer',
  'ach-bonus-buyer-desc': 'Purchase a bonus round',
  'ach-gambler': 'Gambler',
  'ach-gambler-desc': 'Use the gamble feature',
  'ach-risk-taker': 'Risk Taker',
  'ach-risk-taker-desc': 'Win 3 gambles in a row',
  'ach-big-spender': 'Big Spender',
  'ach-big-spender-desc': 'Wager 10000 lifetime',
};

export type StringKey = keyof typeof en;
