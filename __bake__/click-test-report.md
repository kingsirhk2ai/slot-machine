# Click test report

Generated: 2026-05-11T17:04:03.244Z
Preview URL: http://localhost:4174/
Canvas frame: `{"left":0,"top":84.25,"width":1400,"height":787.5}`

**Result: 13 / 13 pass**

| # | Button | Pass | Detail |
|---|---|---|---|
| 1 | SPIN button | ✅ | `{"hitPoints":[{"at":[640,518],"hit":true},{"at":[600,478],"hit":true},{"at":[680,478],"hit":true},{"at":[600,558],"hit":true},{"at":[680,558],"hit":true}],"domClickTriggered":true,"before":{"betPerLine":1,"activeLines":20,"spinning":false,"menuOpen":false,"modalOpen":false,"autoActive":false,"muted":false},"after":{"betPerLine":1,"activeLines":20,"spinning":true,"menuOpen":false,"modalOpen":false,"autoActive":false,"muted":false}}` |
| 2 | BET + | ✅ | `{"before":1,"after":5}` |
| 3 | BET − | ✅ | `{"before":10,"after":5}` |
| 4 | LINES + | ✅ | `{"before":15,"after":20}` |
| 5 | LINES − | ✅ | `{"before":20,"after":15}` |
| 6 | AUTO button (open menu) | ✅ | `{"before":false,"after":true}` |
| 7 | AUTO menu item (10 spins) | ✅ | `{"menuClosed":true,"autoActive":true,"spinning":true}` |
| 8 | AUTO STOP (click while running) | ✅ | `{"before":true,"after":false}` |
| 9 | PAYTABLE ? button (open modal) | ✅ | `{"before":false,"after":true}` |
| 10 | PaytableModal × close | ✅ | `{"before":true,"after":false}` |
| 11 | PaytableModal backdrop close | ✅ | `{"before":true,"after":false}` |
| 12 | Mute toggle | ✅ | `{"initial":false,"afterClick":true,"toggledBack":false}` |
| 13 | 5-point hit coverage (all buttons) | ✅ | `[{"button":"SPIN","points":[{"at":[640,518],"hitCount":1,"top":"X"},{"at":[604,482],"hitCount":1,"top":"X"},{"at":[676,482],"hitCount":1,"top":"X"},{"at":[604,554],"hitCount":1,"top":"X"},{"at":[676,554],"hitCount":1,"top":"X"}],"allHit":true},{"button":"BET +","points":[{"at":[343,483],"hitCount":1,"top":"initialize"},{"at":[334,474],"hitCount":1,"top":"initialize"},{"at":[352,474],"hitCount":1,"top":"initialize"},{"at":[334,492],"hitCount":1,"top":"initialize"},{"at":[352,492],"hitCount":1,"top":"initialize"}],"allHit":true},{"button":"BET −","points":[{"at":[157,483],"hitCount":1,"top":"initialize"},{"at":[148,474],"hitCount":1,"top":"initialize"},{"at":[166,474],"hitCount":1,"top":"initialize"},{"at":[148,492],"hitCount":1,"top":"initialize"},{"at":[166,492],"hitCount":1,"top":"initialize"}],"allHit":true},{"button":"LINES +","points":[{"at":[343,553],"hitCount":1,"top":"initialize"},{"at":[334,544],"hitCount":1,"top":"initialize"},{"at":[352,544],"hitCount":1,"top":"initialize"},{"at":[334,562],"hitCount":1,"top":"initialize"},{"at":[352,562],"hitCount":1,"top":"initialize"}],"allHit":true},{"button":"LINES −","points":[{"at":[157,553],"hitCount":1,"top":"initialize"},{"at":[148,544],"hitCount":1,"top":"initialize"},{"at":[166,544],"hitCount":1,"top":"initialize"},{"at":[148,562],"hitCount":1,"top":"initialize"},{"at":[166,562],"hitCount":1,"top":"initialize"}],"allHit":true},{"button":"AUTO","points":[{"at":[1030,483],"hitCount":1,"top":"initialize"},{"at":[993,464],"hitCount":1,"top":"initialize"},{"at":[1067,464],"hitCount":1,"top":"initialize"},{"at":[993,502],"hitCount":1,"top":"initialize"},{"at":[1067,502],"hitCount":1,"top":"initialize"}],"allHit":true},{"button":"PAYTABLE ?","points":[{"at":[1030,553],"hitCount":1,"top":"initialize"},{"at":[1017,540],"hitCount":1,"top":"initialize"},{"at":[1043,540],"hitCount":1,"top":"initialize"},{"at":[1017,566],"hitCount":1,"top":"initialize"},{"at":[1043,566],"hitCount":1,"top":"initialize"}],"allHit":true},{"button":"Mute","points":[{"at":[1242,38],"hitCount":1,"top":"initialize"},{"at":[1226,22],"hitCount":1,"top":"initialize"},{"at":[1258,22],"hitCount":1,"top":"initialize"},{"at":[1226,54],"hitCount":1,"top":"initialize"},{"at":[1258,54],"hitCount":1,"top":"initialize"}],"allHit":true}]` |

## How it was tested

- Headless Chromium (Playwright). `page.mouse.click` dispatches real `mousedown`/`mouseup` to the canvas at CSS pixel coords.
- Game coords (1280×720) → CSS coords via `canvas.getBoundingClientRect()` scaling.
- For each button: click center, then 4 corner offsets (40px inside circular buttons; ±18px from rect button center for rectangulars).
- Pass = the relevant game state changed (e.g., `MainScene.betPerLine`, `MainScene.spinning`, modal/menu visibility, `game.sound.mute`).

## Root cause of prior misclicks

Phaser 3.90 hard-codes `Container.displayOriginX = width * 0.5` (and same for Y). `InputManager.pointWithinHitArea` adds `displayOriginX/Y` to the local hit-test point before running the hit-area callback — for top-level AND nested Containers. Any Container with `setSize(w, h)` and a hit area centered at `(0, 0)` was therefore tested at `(w/2, h/2)`, missing clicks.

Fix: `containerInput.ts → enableContainerInput()` shifts the hit-area shape by `+(w/2, h/2)` to align with where Phaser does the test. The unified `makeButton()` helper wraps this + hover/press tween + pointer cursor and is now used by every button.