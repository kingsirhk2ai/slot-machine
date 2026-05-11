import Phaser from 'phaser';
import { enableContainerInput, makeButton } from './containerInput';
import { audio } from '../systems/AudioManager';

interface AutoSpinOptions {
  spin: () => void;
  isSpinning: () => boolean;
  canSpin: () => boolean;
  onStateChange?: (state: AutoSpinState) => void;
}

export type AutoSpinState =
  | { kind: 'idle' }
  | { kind: 'running'; remaining: number; total: number };

const COUNT_OPTIONS = [10, 25, 50, Infinity] as const;
const INTER_SPIN_DELAY = 800;

/**
 * Renders an "AUTO" toggle button next to SPIN. When clicked it pops a small
 * menu (10 / 25 / 50 / ∞). After selecting, runs `spin()` repeatedly until the
 * count is exhausted, the user toggles off, or the balance is insufficient.
 */
export class AutoSpinController {
  private menuContainer?: Phaser.GameObjects.Container;
  private menuOpen = false;
  private state: AutoSpinState = { kind: 'idle' };
  private waitTimer?: Phaser.Time.TimerEvent;
  public readonly button: Phaser.GameObjects.Container;
  private readonly labelText: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    btnX: number,
    btnY: number,
    private readonly opts: AutoSpinOptions,
  ) {
    const w = 80;
    const h = 44;
    const c = scene.add.container(btnX, btnY);
    c.setDepth(150);
    const g = scene.add.graphics();
    g.fillStyle(0x1a1a2e, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(2, 0xffd700, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(1, 0xffd700, 0.3);
    g.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 8);
    c.add(g);

    this.labelText = scene.add
      .text(0, 0, 'AUTO', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0.5);
    c.add(this.labelText);

    c.setSize(w, h);
    enableContainerInput(c, new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    c.on('pointerover', () => {
      scene.input.setDefaultCursor('pointer');
      scene.tweens.add({ targets: c, scale: 1.06, duration: 100, ease: 'Sine.Out' });
    });
    c.on('pointerout', () => {
      scene.input.setDefaultCursor('default');
      scene.tweens.add({ targets: c, scale: 1, duration: 100, ease: 'Sine.Out' });
    });
    c.on('pointerdown', () => {
      audio.play('click');
      this.handleClick();
    });

    this.button = c;
  }

  private handleClick(): void {
    if (this.state.kind === 'running') {
      this.stop();
      return;
    }
    this.toggleMenu();
  }

  private toggleMenu(): void {
    if (this.menuOpen) this.closeMenu();
    else this.openMenu();
  }

  private openMenu(): void {
    this.menuOpen = true;
    const items = COUNT_OPTIONS;
    const itemW = 76;
    const itemH = 32;
    const gap = 6;
    const totalH = items.length * itemH + (items.length - 1) * gap;
    const startY = -((this.button as Phaser.GameObjects.Container).getBounds().height / 2) - totalH - 10;
    const container = this.scene.add.container(this.button.x, this.button.y);
    container.setDepth(200);

    for (let i = 0; i < items.length; i++) {
      const val = items[i];
      const y = startY + i * (itemH + gap) + itemH / 2;
      const c = makeButton(this.scene, 0, y, {
        shape: 'rect',
        w: itemW,
        h: itemH,
        hoverScale: 1.06,
        pressScale: 0.94,
        onClick: () => {
          audio.play('click');
          this.closeMenu();
          this.start(val);
        },
      });
      const g = this.scene.add.graphics();
      g.fillStyle(0x0a0a18, 1);
      g.fillRoundedRect(-itemW / 2, -itemH / 2, itemW, itemH, 6);
      g.lineStyle(2, 0xffd700, 1);
      g.strokeRoundedRect(-itemW / 2, -itemH / 2, itemW, itemH, 6);
      c.add(g);
      const t = this.scene.add
        .text(0, 0, val === Infinity ? '∞' : String(val), {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '17px',
          fontStyle: 'bold',
          color: '#ffd700',
        })
        .setOrigin(0.5);
      c.add(t);
      container.add(c);
    }
    container.setAlpha(0);
    this.scene.tweens.add({ targets: container, alpha: 1, duration: 140 });
    this.menuContainer = container;
  }

  private closeMenu(): void {
    this.menuOpen = false;
    this.menuContainer?.destroy();
    this.menuContainer = undefined;
  }

  private start(count: number): void {
    const total = count === Infinity ? -1 : count;
    this.state = { kind: 'running', remaining: total, total };
    this.labelText.setText('STOP');
    this.labelText.setColor('#ff5566');
    this.opts.onStateChange?.(this.state);
    this.tryNextSpin();
  }

  public stop(): void {
    if (this.state.kind !== 'running') return;
    this.state = { kind: 'idle' };
    this.waitTimer?.remove();
    this.waitTimer = undefined;
    this.labelText.setText('AUTO');
    this.labelText.setColor('#ffd700');
    this.opts.onStateChange?.(this.state);
  }

  public isAutoActive(): boolean {
    return this.state.kind === 'running';
  }

  /** Called by MainScene after each spin completes. */
  public onSpinComplete(): void {
    if (this.state.kind !== 'running') return;
    if (this.state.total !== -1) {
      this.state = { ...this.state, remaining: this.state.remaining - 1 };
      if (this.state.remaining <= 0) {
        this.stop();
        return;
      }
    }
    this.opts.onStateChange?.(this.state);
    this.waitTimer = this.scene.time.delayedCall(INTER_SPIN_DELAY, () => this.tryNextSpin());
  }

  private tryNextSpin(): void {
    if (this.state.kind !== 'running') return;
    if (!this.opts.canSpin()) {
      this.stop();
      return;
    }
    if (this.opts.isSpinning()) {
      // wait briefly and try again
      this.waitTimer = this.scene.time.delayedCall(200, () => this.tryNextSpin());
      return;
    }
    this.opts.spin();
  }
}
