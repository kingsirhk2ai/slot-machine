# Audio test checklist

Manual verification list for the 11 sound events + 1 BGM. Run `pnpm preview --port 4174 --strictPort` and check each event in a real browser tab (audio cannot auto-play on first load — click anywhere first to unlock the AudioContext).

## Generated assets

| Key | File | Size | Duration target | Notes |
|---|---|---|---|---|
| `click` | `public/sfx/click.mp3` | ~1.9 KB | 80 ms | Short 900 Hz pulse with quick fade |
| `spin-start` | `public/sfx/spin-start.mp3` | ~4.4 KB | 300 ms | Two layered FM whoosh sweeps |
| `reel-loop` | `public/sfx/reel-loop.mp3` | ~13 KB | 1 s (loopable) | 90+180 Hz sines + sawtooth, AM-modulated |
| `reel-stop` | `public/sfx/reel-stop.mp3` | ~2.2 KB | 120 ms | 1200 Hz + 600 Hz with exp decay |
| `reel-stop-final` | `public/sfx/reel-stop-final.mp3` | ~3.8 KB | 250 ms | 420 + 180 + 1100 Hz layered |
| `win-small` | `public/sfx/win-small.mp3` | ~5.7 KB | 400 ms | C5 → E5 |
| `win-medium` | `public/sfx/win-medium.mp3` | ~9.1 KB | 700 ms | C5 E5 G5 C6 arpeggio |
| `win-big` | `public/sfx/win-big.mp3` | ~19 KB | 1.5 s | Ascending arpeggio + sustained chord |
| `coin` | `public/sfx/coin.mp3` | ~2.6 KB | 150 ms | 1760 + 2640 + 880 Hz "ding" |
| `error` | `public/sfx/error.mp3` | ~3.2 KB | 200 ms | 110 Hz sawtooth tremolo |
| `bgm` | `public/bgm/casino-loop.mp3` | ~512 KB | 32 s loop | 4-chord vegas pad (Cmaj → Amin → Fmaj → Gmaj) |

All sounds are synthesised with ffmpeg from `scripts/generate-audio.sh` — fully reproducible, no external assets.

## Event coverage

| # | Event | Sound key | Where wired |
|---|---|---|---|
| 1 | Page load → BGM fade-in | `bgm` | `MainScene.create` → `audio.startBgm()` |
| 2 | SPIN button click | `click` + `spin-start` | `SpinButton.pointerdown` + `MainScene.handleSpin` |
| 3 | Reels spinning | `reel-loop` (looped) | `MainScene.handleSpin` |
| 4 | Each reel stops (1–4) | `reel-stop` | `reel.spinTo` callback, `isFinal === false` |
| 5 | Final reel stops | `reel-stop-final` | `reel.spinTo` callback, `isFinal === true` |
| 6 | Win (small / single line / < 3× bet) | `win-small` | `MainScene.onAllReelsStopped` |
| 7 | Win (medium / ≥3 lines or ≥3× bet) | `win-medium` | `MainScene.onAllReelsStopped` |
| 8 | Win (big / ≥10× bet) | `win-big` | `MainScene.onAllReelsStopped` |
| 9 | Coin lands in CREDIT panel | `coin` (throttled) | `WinFx.coinBurst` per-coin `onComplete` |
| 10 | Insufficient balance | `error` | `MainScene.indicateInsufficient` |
| 11 | Generic button click | `click` | `Stepper`, `AutoSpin` button + menu, `PaytableModal` ?/×/backdrop, `MuteButton` |

## Manual test plan

| Step | Expected | Pass? |
|---|---|---|
| Open localhost:4174, click anywhere on canvas | BGM begins fading in (~1.2s ramp) | ☐ |
| Click 🔊 mute button (top-right) | Glyph flips to 🔇, all audio silences | ☐ |
| Click 🔇 again | Glyph flips back to 🔊, BGM resumes | ☐ |
| Click SPIN | `click` then `spin-start` whoosh, then `reel-loop` low rumble | ☐ |
| Wait for reels to stop | 4 × `reel-stop` ticks (one per non-final reel), then `reel-stop-final` thunk; `reel-loop` cuts at final | ☐ |
| Land any win | Coin burst → many `coin` dings (throttled, max 6 per 100 ms); win sfx fits magnitude | ☐ |
| Set BET to 50 + LINES to 20, repeatedly press SPIN until balance < 1000 | `error` buzz when balance < totalBet | ☐ |
| Click BET +, BET −, LINES +, LINES − | Each emits a short `click` | ☐ |
| Click AUTO (open menu) | `click` on open, another `click` on menu item selection | ☐ |
| Click "?" paytable | `click` on open, `click` on close × or backdrop | ☐ |
| Reload page | Mute preference persists (check localStorage `slot-audio-prefs`) | ☐ |

## Volume balance defaults

- `sfxVol = 0.7`, `bgmVol = 0.35`, `mute = false`
- Coin sfx clamped to 6 plays per 100 ms with ±9% pitch jitter so coin showers don't sound like a single overlapping drone.
- BGM starts at 0 and tweens up over 1.2s on `MainScene.create`.

## Regenerating audio

If the synthesized sounds need tweaking, edit `scripts/generate-audio.sh` and re-run:

```bash
bash scripts/generate-audio.sh
```

Idempotent — all 11 files are overwritten in place from ffmpeg lavfi sources.
