import Phaser from 'phaser';
import type { ReelStrip } from '../systems/ReelStrip';
import type { RNG } from '../systems/RNG';
import { getSymbol } from '../data/symbols';

const VISIBLE_ROWS = 3;
const PAD_ROWS = 2;
const N_DISPLAY = VISIBLE_ROWS + PAD_ROWS * 2;

export class ReelView extends Phaser.GameObjects.Container {
  public readonly strip: ReelStrip;
  private readonly symbolSize: number;
  private readonly cells: Phaser.GameObjects.Text[] = [];
  private readonly cellStripIndex: number[] = [];
  // Continuous strip-index of the top visible row (integer when aligned).
  private topStripIndex = 0;
  private spinning = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    strip: ReelStrip,
    symbolSize: number,
    _rng: RNG,
  ) {
    super(scene, x, y);
    this.strip = strip;
    this.symbolSize = symbolSize;

    // Cell backgrounds (3 visible).
    const bg = scene.add.graphics();
    for (let i = 0; i < VISIBLE_ROWS; i++) {
      bg.fillStyle(0x0d0d18, 0.92);
      bg.fillRoundedRect(
        -symbolSize / 2 + 3,
        i * symbolSize + 3,
        symbolSize - 6,
        symbolSize - 6,
        8,
      );
      bg.lineStyle(2, 0x2a2a44, 1);
      bg.strokeRoundedRect(
        -symbolSize / 2 + 3,
        i * symbolSize + 3,
        symbolSize - 6,
        symbolSize - 6,
        8,
      );
    }
    this.add(bg);

    // Symbol text cells.
    const fontSize = Math.floor(symbolSize * 0.55);
    for (let k = 0; k < N_DISPLAY; k++) {
      const txt = scene.add
        .text(0, 0, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: `${fontSize}px`,
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      this.add(txt);
      this.cells.push(txt);
      this.cellStripIndex.push(-1);
    }

    // Geometry mask covers exactly the 3 visible rows in world space.
    const maskGfx = scene.make.graphics({ x: 0, y: 0 }, false);
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(x - symbolSize / 2, y, symbolSize, symbolSize * VISIBLE_ROWS);
    this.setMask(maskGfx.createGeometryMask());

    scene.add.existing(this);
    this.refresh();
  }

  private refresh(): void {
    const base = Math.floor(this.topStripIndex);
    const frac = this.topStripIndex - base;
    const n = this.strip.length;

    for (let k = 0; k < N_DISPLAY; k++) {
      const p = k - PAD_ROWS; // visual row offset (-PAD_ROWS .. VISIBLE_ROWS+PAD_ROWS-1)
      const stripIdx = base + p;
      const normIdx = ((stripIdx % n) + n) % n;
      const cell = this.cells[k];

      if (this.cellStripIndex[k] !== normIdx) {
        const def = getSymbol(this.strip.getSymbolAt(stripIdx));
        cell.setText(def.glyph);
        cell.setColor(`#${def.color.toString(16).padStart(6, '0')}`);
        this.cellStripIndex[k] = normIdx;
      }

      cell.setY(p * this.symbolSize + frac * this.symbolSize + this.symbolSize / 2);
    }
  }

  spinTo(targetStopIndex: number, durationMs: number, onComplete: () => void): void {
    if (this.spinning) {
      onComplete();
      return;
    }
    this.spinning = true;

    const n = this.strip.length;
    const startTop = Math.round(this.topStripIndex);
    // Symbols flow downward => topStripIndex decreases.
    let baseDelta = ((startTop - targetStopIndex) % n + n) % n;
    if (baseDelta === 0) baseDelta = n;
    const totalDelta = 3 * n + baseDelta; // ~3 extra full revolutions
    const endTop = startTop - totalDelta;

    const state = { v: 0 };
    this.scene.tweens.add({
      targets: state,
      v: 1,
      duration: durationMs,
      ease: 'Cubic.Out',
      onUpdate: () => {
        this.topStripIndex = startTop + (endTop - startTop) * state.v;
        this.refresh();
      },
      onComplete: () => {
        this.topStripIndex = ((targetStopIndex % n) + n) % n;
        this.refresh();
        this.spinning = false;
        onComplete();
      },
    });
  }
}
