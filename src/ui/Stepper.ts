import Phaser from 'phaser';
import { makeButton } from './containerInput';
import { audio } from '../systems/AudioManager';

interface StepperOptions {
  label: string;
  values: readonly number[];
  initial: number;
  width?: number;
  height?: number;
  valueColor?: string;
  onChange: (value: number) => void;
}

/**
 * Generic LED-panel stepper with [−] [value] [+] buttons.
 * Used for BET and LINES controls. Click −/+ cycles through `values`.
 */
export class Stepper extends Phaser.GameObjects.Container {
  private valueText!: Phaser.GameObjects.Text;
  private idx: number;
  private readonly values: readonly number[];
  private readonly onChange: (value: number) => void;
  private disabled = false;
  private readonly minusBtn: Phaser.GameObjects.Container;
  private readonly plusBtn: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: StepperOptions) {
    super(scene, x, y);
    this.values = opts.values;
    this.onChange = opts.onChange;
    const initialIdx = Math.max(0, opts.values.indexOf(opts.initial));
    this.idx = initialIdx === -1 ? 0 : initialIdx;

    const w = opts.width ?? 150;
    const h = opts.height ?? 50;
    const valueColor = opts.valueColor ?? '#4be84b';

    // Panel body.
    const g = scene.add.graphics();
    g.fillGradientStyle(0x0a0a18, 0x0a0a18, 0x05050c, 0x05050c, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(2, 0xffd700, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(1, 0xffd700, 0.3);
    g.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 6);
    this.add(g);

    // Label (top).
    const label = scene.add
      .text(0, -h / 2 + 5, opts.label, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0.5, 0);
    this.add(label);

    // Value (bottom).
    this.valueText = scene.add
      .text(0, h / 2 - 5, String(this.values[this.idx]), {
        fontFamily: '"Courier New", "Menlo", monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        color: valueColor,
      })
      .setOrigin(0.5, 1);
    this.valueText.setShadow(0, 0, valueColor, 6, false, true);
    this.add(this.valueText);

    // Scanlines.
    const scan = scene.add.graphics();
    const ledTop = -h / 2 + 18;
    const ledH = h - 22;
    scan.fillStyle(0x000000, 0.18);
    for (let yy = ledTop; yy < ledTop + ledH; yy += 3) {
      scan.fillRect(-w / 2 + 6, yy, w - 12, 1);
    }
    this.add(scan);

    // Buttons.
    this.minusBtn = this.makeStepperButton(scene, -w / 2 - 18, 0, '−', () => this.step(-1));
    this.plusBtn = this.makeStepperButton(scene, w / 2 + 18, 0, '+', () => this.step(1));
    this.add(this.minusBtn);
    this.add(this.plusBtn);

    scene.add.existing(this);
  }

  private makeStepperButton(
    scene: Phaser.Scene,
    bx: number,
    by: number,
    glyph: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const r = 16;
    const c = makeButton(scene, bx, by, {
      shape: 'circle',
      radius: r,
      isDisabled: () => this.disabled,
      hoverScale: 1.12,
      pressScale: 0.9,
      onClick: () => {
        audio.play('click');
        onClick();
      },
    });
    const g = scene.add.graphics();
    g.fillStyle(0x1a1a2e, 1);
    g.fillCircle(0, 0, r);
    g.lineStyle(2, 0xffd700, 1);
    g.strokeCircle(0, 0, r);
    c.add(g);
    const t = scene.add
      .text(0, 0, glyph, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0.5);
    c.add(t);
    return c;
  }

  private step(dir: number): void {
    const next = Phaser.Math.Clamp(this.idx + dir, 0, this.values.length - 1);
    if (next === this.idx) return;
    this.idx = next;
    this.valueText.setText(String(this.values[this.idx]));
    this.scene.tweens.add({
      targets: this.valueText,
      scale: { from: 1, to: 1.18 },
      duration: 110,
      yoyo: true,
      ease: 'Sine.InOut',
    });
    this.onChange(this.values[this.idx]);
  }

  public getValue(): number {
    return this.values[this.idx];
  }

  public setDisabled(d: boolean): void {
    this.disabled = d;
    const alpha = d ? 0.45 : 1;
    this.minusBtn.setAlpha(alpha);
    this.plusBtn.setAlpha(alpha);
  }
}
