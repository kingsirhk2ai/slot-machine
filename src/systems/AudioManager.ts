import Phaser from 'phaser';

const STORAGE_KEY = 'slot-audio-prefs';

interface AudioPrefs {
  mute: boolean;
  sfxVol: number;
  bgmVol: number;
}

interface PlayOpts {
  volume?: number;
  rate?: number;
  loop?: boolean;
  /** Force a fresh sound instance (allows overlapping plays — used for short polyphonic sfx). */
  polyphonic?: boolean;
}

const DEFAULT_PREFS: AudioPrefs = { mute: false, sfxVol: 0.7, bgmVol: 0.35 };

/** Registry of every sfx key and its source path (relative to /public). */
export const AUDIO_REGISTRY: Record<string, string> = {
  click: 'sfx/click.mp3',
  'spin-start': 'sfx/spin-start.mp3',
  'reel-loop': 'sfx/reel-loop.mp3',
  'reel-stop': 'sfx/reel-stop.mp3',
  'reel-stop-final': 'sfx/reel-stop-final.mp3',
  'win-small': 'sfx/win-small.mp3',
  'win-medium': 'sfx/win-medium.mp3',
  'win-big': 'sfx/win-big.mp3',
  coin: 'sfx/coin.mp3',
  error: 'sfx/error.mp3',
  bgm: 'bgm/casino-loop.mp3',
};

const BGM_KEYS = new Set(['bgm']);

/** Coin sfx is rate-limited (many particles → coin spam). */
const COIN_THROTTLE_MS = 100;
const COIN_MAX_BURST = 6;

class AudioManagerImpl {
  private scene?: Phaser.Scene;
  private prefs: AudioPrefs = { ...DEFAULT_PREFS };
  private bgm?: Phaser.Sound.BaseSound;
  private loopSounds: Record<string, Phaser.Sound.BaseSound | undefined> = {};
  private coinBurst: { count: number; windowStart: number } = { count: 0, windowStart: 0 };

  constructor() {
    this.prefs = this.loadPrefs();
  }

  /** Queue every audio file for preload — call from PreloadScene.preload(). */
  queuePreload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(AUDIO_REGISTRY)) {
      if (scene.cache.audio.exists(key)) continue;
      scene.load.audio(key, path);
    }
  }

  /** Bind the AudioManager to a live scene (call from MainScene.create). */
  attach(scene: Phaser.Scene): void {
    this.scene = scene;
    this.applyPrefsToGame();
  }

  play(key: string, opts: PlayOpts = {}): Phaser.Sound.BaseSound | null {
    if (!this.scene) return null;
    if (!this.scene.cache.audio.exists(key)) return null;
    if (this.prefs.mute) return null;

    const isBgm = BGM_KEYS.has(key);
    const baseVol = isBgm ? this.prefs.bgmVol : this.prefs.sfxVol;
    const volume = (opts.volume ?? 1) * baseVol;
    const config: Phaser.Types.Sound.SoundConfig = {
      volume,
      rate: opts.rate ?? 1,
      loop: !!opts.loop,
    };

    // Polyphonic short sfx — always create a new instance and let it auto-clean.
    if (opts.polyphonic) {
      const s = this.scene.sound.add(key, config);
      s.once('complete', () => s.destroy());
      s.play();
      return s;
    }

    // Looped sound — keep one instance keyed by name.
    if (config.loop) {
      const existing = this.loopSounds[key];
      if (existing && existing.isPlaying) return existing;
      const s = existing ?? this.scene.sound.add(key, config);
      this.loopSounds[key] = s;
      s.play(config);
      return s;
    }

    // One-shot — reuse a single instance per key to avoid leaks.
    const existing = this.scene.sound.get(key);
    const s = existing ?? this.scene.sound.add(key, config);
    if (s.isPlaying) s.stop();
    s.play(config);
    return s;
  }

  /** Throttled variant for coin pickup — caps at COIN_MAX_BURST per 100ms. */
  playCoin(): void {
    const now = performance.now();
    if (now - this.coinBurst.windowStart > COIN_THROTTLE_MS) {
      this.coinBurst.windowStart = now;
      this.coinBurst.count = 0;
    }
    if (this.coinBurst.count >= COIN_MAX_BURST) return;
    this.coinBurst.count++;
    // Slight pitch jitter so consecutive coins don't sound identical.
    const rate = 0.92 + Math.random() * 0.18;
    this.play('coin', { polyphonic: true, rate, volume: 0.55 });
  }

  stop(key: string): void {
    if (!this.scene) return;
    const loop = this.loopSounds[key];
    if (loop) {
      loop.stop();
      return;
    }
    const s = this.scene.sound.get(key);
    if (s) s.stop();
  }

  /** Play BGM with a soft fade-in. */
  startBgm(): void {
    if (!this.scene) return;
    if (!this.scene.cache.audio.exists('bgm')) return;
    if (this.bgm && this.bgm.isPlaying) return;
    this.bgm = this.scene.sound.add('bgm', {
      loop: true,
      volume: 0,
    });
    this.bgm.play();
    const target = this.prefs.mute ? 0 : this.prefs.bgmVol;
    this.scene.tweens.add({
      targets: this.bgm,
      volume: target,
      duration: 1200,
      ease: 'Sine.Out',
    });
  }

  setMute(mute: boolean): void {
    this.prefs.mute = mute;
    this.savePrefs();
    this.applyPrefsToGame();
  }

  isMuted(): boolean {
    return this.prefs.mute;
  }

  setSfxVolume(v: number): void {
    this.prefs.sfxVol = Phaser.Math.Clamp(v, 0, 1);
    this.savePrefs();
  }

  setBgmVolume(v: number): void {
    this.prefs.bgmVol = Phaser.Math.Clamp(v, 0, 1);
    this.savePrefs();
    if (this.bgm && this.bgm.isPlaying && !this.prefs.mute) {
      (this.bgm as Phaser.Sound.WebAudioSound).setVolume(this.prefs.bgmVol);
    }
  }

  private applyPrefsToGame(): void {
    if (!this.scene) return;
    this.scene.sound.mute = this.prefs.mute;
  }

  private loadPrefs(): AudioPrefs {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      const parsed = JSON.parse(raw);
      return {
        mute: typeof parsed.mute === 'boolean' ? parsed.mute : DEFAULT_PREFS.mute,
        sfxVol: typeof parsed.sfxVol === 'number' ? parsed.sfxVol : DEFAULT_PREFS.sfxVol,
        bgmVol: typeof parsed.bgmVol === 'number' ? parsed.bgmVol : DEFAULT_PREFS.bgmVol,
      };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // ignore — storage may be unavailable
    }
  }
}

export const audio = new AudioManagerImpl();
export type AudioManager = AudioManagerImpl;
