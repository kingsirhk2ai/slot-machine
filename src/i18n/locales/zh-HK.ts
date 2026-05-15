// Traditional Chinese (Hong Kong / Cantonese register). Mirrors en.ts keys.
import type { StringKey } from './en';

export const zhHK: Record<StringKey, string> = {
  // Core actions
  'spin': '開始',
  'spinning': '轉動中',
  'stop': '停',
  'max': '最大',
  'cancel': '取消',
  'reset': '重設',
  'on': '開',
  'off': '關',
  'no-thanks': '唔使,多謝',
  'share': '分享',

  // HUD
  'credit': '餘額',
  'bet': '注額',
  'lines': '線數',
  'total-bet': '總注',
  'win': '中獎',
  'last': '上次',

  // Streak
  'streak': '連勝',

  // Win badges
  'win-badge': '中獎',
  'mega-win': '超級大獎',
  'big-win': '大獎',

  // Free spins
  'free-spins-banner': '免費旋轉!',
  'free-spins-complete': '免費旋轉結束',
  'total-plus': '總共 +{n}',
  'scatter-trigger': '{count}× 散獎  →  +{spins} 次免費',
  'free-spin-status': '免費旋轉  {used}/{total}   ×{mult}',
  'bonus-purchased': '已購買獎勵\n{spins} 次免費旋轉',

  // Paytable
  'paytable': '賠率表',
  'paytable-symbol': '圖案',
  'paytable-x3': 'x3',
  'paytable-x4': 'x4',
  'paytable-x5': 'x5',
  'paytable-hint': '倍數 × 每線注額。由左至右,3 個或以上連線。',

  // Settings
  'settings': '設定',
  'mute': '靜音',
  'sfx': '音效',
  'music': '音樂',
  'quick-spin': '快速旋轉',
  'gamble': '博彩',
  'this-session': '今次紀錄',
  'spins': '次數',
  'wagered': '下注',
  'won': '贏取',
  'net': '淨賺',
  'top-up': '+ 增值',
  'language': '語言',

  // Refill
  'out-of-credits': '餘額不足',
  'refill-broke': '冇晒籌碼啦,加返啲?',
  'refill-manual': '增值 {n} 籌碼到你嘅餘額。',
  'refill-button': '+{n}  籌碼',

  // Buy Bonus
  'buy-bonus': '購買獎勵',
  'buy-free-spins': '購買免費旋轉',
  'free-spins-award': '{n} 次免費旋轉',
  'with-multiplier': '附帶 ×2 中獎倍數',
  'cost': '費用',
  'balance': '餘額',
  'buy-cta': '購買 {cost}',
  'not-enough': '唔夠籌碼',

  // Gamble
  'double-or-nothing': '加倍或全失',
  'gamble-prompt': '贏 {win}  →  變 {doubled}?',
  'red': '紅',
  'black': '黑',
  'gamble-take': '撳外面拎走獎金',
  'gamble-win': '+{n}  中獎!',
  'gamble-bust': '輸晒',

  // Daily reward
  'daily-reward': '每日獎勵',
  'daily-reward-sub': '連續登入賺取更多!',
  'claim': '領取',
  'claim-amount': '+{n}',
  'come-back-tomorrow': '聽日再嚟攞下一個獎勵!',
  'streak-day': '第 {n} 日',
  'streak-broken': '連勝中斷  重新由第 1 日開始',
  'streak-current': '連續登入 {n} 日',

  // Achievements
  'achievements': '成就',
  'achievement-unlocked': '解鎖成就!',
  'ach-locked': '未解鎖',
  'ach-progress': '{n} / {total}',
  'ach-completed': '已解鎖 {n} / {total}',

  'ach-first-spin': '初試啼聲',
  'ach-first-spin-desc': '完成第一次旋轉',
  'ach-veteran': '老手',
  'ach-veteran-desc': '旋轉 100 次',
  'ach-spin-master': '旋轉大師',
  'ach-spin-master-desc': '旋轉 1000 次',
  'ach-big-winner': '大贏家',
  'ach-big-winner-desc': '單次中獎 500',
  'ach-mega-winner': '超級大贏家',
  'ach-mega-winner-desc': '中過超級大獎',
  'ach-lucky-streak': '連勝好手',
  'ach-lucky-streak-desc': '連續贏 5 次',
  'ach-hot-streak': '熱手連勝',
  'ach-hot-streak-desc': '連續贏 8 次',
  'ach-bonus-hunter': '獎勵獵人',
  'ach-bonus-hunter-desc': '觸發免費旋轉',
  'ach-bonus-buyer': '獎勵買家',
  'ach-bonus-buyer-desc': '購買獎勵回合',
  'ach-gambler': '賭徒',
  'ach-gambler-desc': '試用博彩功能',
  'ach-risk-taker': '冒險王',
  'ach-risk-taker-desc': '連續博彩贏 3 次',
  'ach-big-spender': '豪客',
  'ach-big-spender-desc': '累計下注 10000',
};
