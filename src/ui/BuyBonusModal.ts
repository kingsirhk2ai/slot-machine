import Phaser from 'phaser';
import { audio } from '../systems/AudioManager';
import { enableContainerInput, makeButton } from './containerInput';

const DEPTH = 400;
export const BUY_BONUS_MULTIPLIER = 60;
export const BUY_BONUS_FREE_SPINS = 10;

interface BuyBonusOpts {
  /** Called for the per-bet cost. Recomputed each open. */
  getTotalBet: () => number;
  /** Called for the player's current balance. */
  getBalance: () => number;
  /** Returns true if the game is currently busy (spinning or in free spins). */
  isBusy: () => boolean;
  /** Invoked on confirm. Caller is responsible for deducting cost + starting free spins. */
  onConfirm: (cost: number, freeSpins: number) => void;
}

/**
 * "BUY BONUS" pill button + confirm modal. Lets the player skip the scatter
 * grind and immediately purchase a fixed batch of free spins for a big
 * up-front cost. Standard premium-slot mechanic — disabled while spinning
 * or while free spins are already running.
 */
export class BuyBonusModal {
  private container?: Phaser.GameObjects.Container;
  private isOpen = false;
  public readonly button: Phaser.GameObjects.Container;
  private bgGfx!: Phaser.GameObjects.Graphics;
  private labelText!: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    private readonly scene: Phaser.Scene,
    btnX: number,
    btnY: number,
    private readonly opts: BuyBonusOpts,
  ) {
    this.button = this.buildPillButton(btnX, btnY);
  }

  setEnabled(v: boolean): void {
    if (this.enabled === v) return;
    this.enabled = v;
    this.refreshButton();
  }

  private buildPillButton(x: number, y: number): Phaser.GameObjects.Container {
    const w = 110;
    const h = 30;
    const c = this.scene.add.container(x, y);
    c.setDepth(180);
    c.setSize(w, h);

    const bg = this.scene.add.graphics();
    c.add(bg);
    this.bgGfx = bg;

    const label = this.scene.add
      .text(0, 0, 'BUY BONUS', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#1a0a00',
      })
      .setOrigin(0.5);
    c.add(label);
    this.labelText = label;

    enableContainerInput(c, new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    c.on('pointerover', () => {
      if (!this.enabled) return;
      this.scene.input.setDefaultCursor('pointer');
      this.scene.tweens.add({ targets: c, scale: 1.06, duration: 120, ease: 'Sine.Out' });
    });
    c.on('pointerout', () => {
      this.scene.input.setDefaultCursor('default');
      this.scene.tweens.add({ targets: c, scale: 1, duration: 120, ease: 'Sine.Out' });
    });
    c.on('pointerdown', () => {
      if (!this.enabled) {
        audio.play('error');
        this.scene.tweens.add({
          targets: c,
          x: { from: x - 4, to: x + 4 },
          duration: 60,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.InOut',
          onComplete: () => { c.x = x; },
        });
        return;
      }
      audio.play('click');
      this.toggle();
    });

    this.refreshButton();

    // Soft idle pulse to draw the eye, only when enabled.
    this.scene.tweens.add({
      targets: c,
      scale: { from: 1, to: 1.04 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    return c;
  }

  private refreshButton(): void {
    const w = 110;
    const h = 30;
    const bg = this.bgGfx;
    bg.clear();
    if (this.enabled) {
      bg.fillGradientStyle(0xffe98a, 0xffe98a, 0xffd700, 0xc9920a, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(2, 0xfff4b3, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(1, 0x6a4a08, 0.85);
      bg.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2);
      this.labelText.setColor('#1a0a00');
      this.labelText.setAlpha(1);
    } else {
      bg.fillStyle(0x33334a, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(1.5, 0x666688, 0.8);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      this.labelText.setColor('#88889e');
      this.labelText.setAlpha(0.7);
    }
  }

  public toggle(): void {
    if (this.opts.isBusy()) {
      audio.play('error');
      return;
    }
    if (this.isOpen) this.close();
    else this.open();
  }

  public open(): void {
    if (this.isOpen) return;
    if (this.opts.isBusy()) return;
    this.isOpen = true;

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const MODAL_W = Math.min(380, W - 24);
    const MODAL_H = Math.min(280, H - 24);
    const totalBet = this.opts.getTotalBet();
    const cost = totalBet * BUY_BONUS_MULTIPLIER;
    const balance = this.opts.getBalance();
    const canAfford = balance >= cost;

    const container = this.scene.add.container(0, 0);
    container.setDepth(DEPTH);
    this.container = container;

    // Backdrop.
    const backdrop = this.scene.add.graphics();
    backdrop.fillStyle(0x000000, 0.7);
    backdrop.fillRect(0, 0, W, H);
    backdrop.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    backdrop.on('pointerdown', () => {
      audio.play('click');
      this.close();
    });
    container.add(backdrop);

    const mx = (W - MODAL_W) / 2;
    const my = (H - MODAL_H) / 2;
    const cxCenter = W / 2;

    const panel = this.scene.add.graphics();
    panel.fillGradientStyle(0x141430, 0x141430, 0x07071a, 0x07071a, 1);
    panel.fillRoundedRect(mx, my, MODAL_W, MODAL_H, 14);
    panel.lineStyle(3, 0xffd700, 1);
    panel.strokeRoundedRect(mx, my, MODAL_W, MODAL_H, 14);
    panel.lineStyle(1, 0xffd700, 0.3);
    panel.strokeRoundedRect(mx + 6, my + 6, MODAL_W - 12, MODAL_H - 12, 10);
    panel.setInteractive(
      new Phaser.Geom.Rectangle(mx, my, MODAL_W, MODAL_H),
      Phaser.Geom.Rectangle.Contains,
    );
    panel.on('pointerdown', (
      _p: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
    });
    container.add(panel);

    const title = this.scene.add
      .text(cxCenter, my + 22, 'BUY FREE SPINS', {
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0.5, 0);
    title.setShadow(0, 2, '#000000', 4, false, true);
    container.add(title);

    // Award text — big, central.
    const award = this.scene.add
      .text(cxCenter, my + 76, `${BUY_BONUS_FREE_SPINS} FREE SPINS`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#44eaff',
      })
      .setOrigin(0.5);
    award.setShadow(0, 0, '#44eaff', 12, false, true);
    container.add(award);

    const sub = this.scene.add
      .text(cxCenter, my + 108, 'with ×2 win multiplier', {
        fontFamily: '"Arial", sans-serif',
        fontSize: '13px',
        fontStyle: 'italic',
        color: '#bcbcd6',
      })
      .setOrigin(0.5);
    container.add(sub);

    // Cost row.
    this.addStatRow(container, mx + 28, my + 148, MODAL_W - 56, 'COST', `${cost}`, '#ff8a3a');
    this.addStatRow(container, mx + 28, my + 174, MODAL_W - 56, 'BALANCE', `${balance}`,
      canAfford ? '#4be84b' : '#ff5566');

    // Buy / Cancel buttons.
    const btnY = my + MODAL_H - 38;
    const btnW = 130;
    const btnH = 38;
    const cancelX = mx + MODAL_W * 0.32;
    const buyX = mx + MODAL_W * 0.68;

    this.addActionButton(container, cancelX, btnY, btnW, btnH, 'CANCEL', '#bcbcd6', () => {
      audio.play('click');
      this.close();
    }, true);

    this.addActionButton(container, buyX, btnY, btnW, btnH, canAfford ? `BUY ${cost}` : 'NOT ENOUGH',
      canAfford ? '#1a0a00' : '#88889e', () => {
        if (!canAfford) {
          audio.play('error');
          return;
        }
        audio.play('win-medium');
        const c = cost;
        this.close();
        this.opts.onConfirm(c, BUY_BONUS_FREE_SPINS);
      }, false, canAfford);

    // Close X.
    const closeR = 16;
    const closeC = makeButton(this.scene, mx + MODAL_W - 26, my + 26, {
      shape: 'circle',
      radius: closeR,
      hoverScale: 1.12,
      pressScale: 0.9,
      onClick: () => {
        audio.play('click');
        this.close();
      },
    });
    const closeG = this.scene.add.graphics();
    closeG.fillStyle(0x1a1a2e, 1);
    closeG.fillCircle(0, 0, closeR);
    closeG.lineStyle(2, 0xff6677, 1);
    closeG.strokeCircle(0, 0, closeR);
    closeC.add(closeG);
    const closeT = this.scene.add
      .text(0, 0, '×', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '22px',
        color: '#ff6677',
      })
      .setOrigin(0.5);
    closeC.add(closeT);
    container.add(closeC);

    container.setAlpha(0);
    this.scene.tweens.add({ targets: container, alpha: 1, duration: 180, ease: 'Sine.Out' });
  }

  public close(): void {
    if (!this.isOpen || !this.container) return;
    const c = this.container;
    this.isOpen = false;
    this.container = undefined;
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: 140,
      ease: 'Sine.In',
      onComplete: () => c.destroy(),
    });
  }

  private addStatRow(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    label: string,
    value: string,
    valueColor: string,
  ): void {
    const labelT = this.scene.add
      .text(x, y, label, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0, 0.5);
    parent.add(labelT);
    const valT = this.scene.add
      .text(x + w, y, value, {
        fontFamily: '"Courier New", monospace',
        fontSize: '17px',
        fontStyle: 'bold',
        color: valueColor,
      })
      .setOrigin(1, 0.5);
    parent.add(valT);
  }

  private addActionButton(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    textColor: string,
    onClick: () => void,
    secondary: boolean,
    enabled = true,
  ): void {
    const wrap = makeButton(this.scene, x, y, {
      shape: 'rect',
      w,
      h,
      hoverScale: enabled ? 1.05 : 1,
      pressScale: enabled ? 0.95 : 1,
      onClick,
    });
    parent.add(wrap);

    const bg = this.scene.add.graphics();
    if (secondary) {
      bg.fillStyle(0x222238, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(1.5, 0x666688, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    } else if (enabled) {
      bg.fillGradientStyle(0xffe98a, 0xffe98a, 0xffd700, 0xc9920a, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(2, 0xfff4b3, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    } else {
      bg.fillStyle(0x2a1010, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(1.5, 0x553333, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    }
    wrap.add(bg);

    const t = this.scene.add
      .text(0, 0, label, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: textColor,
      })
      .setOrigin(0.5);
    wrap.add(t);
  }
}
