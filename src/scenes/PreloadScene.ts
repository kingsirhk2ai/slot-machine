import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { SYMBOLS } from '../data/symbols';
import { audio } from '../systems/AudioManager';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const barW = 400;
    const barH = 24;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = GAME_HEIGHT / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 1);
    bg.fillRect(barX, barY, barW, barH);

    const fill = this.add.graphics();
    this.load.on('progress', (value: number) => {
      fill.clear();
      fill.fillStyle(0xffd700, 1);
      fill.fillRect(barX, barY, barW * value, barH);
    });

    // Load symbol PNGs. Missing files trigger a loaderror; ReelView falls back to glyph.
    const seen = new Set<string>();
    for (const sym of SYMBOLS) {
      if (seen.has(sym.key)) continue;
      seen.add(sym.key);
      this.load.image(sym.key, `symbols/${sym.key}.png`);
    }
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[preload] failed to load ${file.key} (${file.src})`);
    });

    audio.queuePreload(this);
  }

  create(): void {
    this.scene.start('MainScene');
  }
}
