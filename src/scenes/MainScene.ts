import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { rng } from '../systems/RNG';
import { ReelStrip } from '../systems/ReelStrip';
import { REEL_STRIPS } from '../data/reelStrips';
import { ReelView } from '../ui/ReelView';

const NUM_REELS = 5;
const VISIBLE_ROWS = 3;
const SYMBOL_SIZE = 96;
const REEL_GAP = 8;

export class MainScene extends Phaser.Scene {
  private reels: ReelView[] = [];
  private spinButton!: Phaser.GameObjects.Text;
  private spinning = false;

  constructor() {
    super({ key: 'MainScene' });
  }

  create(): void {
    // Background gradient.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1d1d3a, 0x1d1d3a, 0x07070f, 0x07070f, 1, 1, 1, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Reel block geometry.
    const totalReelW = NUM_REELS * SYMBOL_SIZE + (NUM_REELS - 1) * REEL_GAP;
    const blockH = VISIBLE_ROWS * SYMBOL_SIZE;
    const blockX = (GAME_WIDTH - totalReelW) / 2;
    const blockY = (GAME_HEIGHT - blockH) / 2 - 30;

    // Gold-bordered frame around the 5×3 area.
    const frame = this.add.graphics();
    const pad = 14;
    frame.fillStyle(0x09091a, 1);
    frame.fillRoundedRect(blockX - pad, blockY - pad, totalReelW + pad * 2, blockH + pad * 2, 16);
    frame.lineStyle(4, 0xffd700, 1);
    frame.strokeRoundedRect(blockX - pad, blockY - pad, totalReelW + pad * 2, blockH + pad * 2, 16);

    // Reels.
    for (let i = 0; i < NUM_REELS; i++) {
      const strip = new ReelStrip(REEL_STRIPS[i]);
      const rx = blockX + i * (SYMBOL_SIZE + REEL_GAP) + SYMBOL_SIZE / 2;
      const reel = new ReelView(this, rx, blockY, strip, SYMBOL_SIZE, rng);
      this.reels.push(reel);
    }

    // Temporary SPIN button.
    const btnY = blockY + blockH + 70;
    this.spinButton = this.add
      .text(GAME_WIDTH / 2, btnY, 'SPIN', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#1a1a2e',
        backgroundColor: '#ffd700',
        padding: { left: 40, right: 40, top: 14, bottom: 14 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.spinButton.on('pointerdown', () => this.handleSpin());
  }

  private handleSpin(): void {
    if (this.spinning) return;
    this.spinning = true;
    this.spinButton.setAlpha(0.5);
    this.spinButton.disableInteractive();

    let finished = 0;
    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      const stop = reel.strip.pickStopIndex(rng);
      const duration = 1200 + i * 250;
      reel.spinTo(stop, duration, () => {
        finished++;
        if (finished === this.reels.length) {
          this.spinning = false;
          this.spinButton.setAlpha(1);
          this.spinButton.setInteractive({ useHandCursor: true });
        }
      });
    }
  }
}
