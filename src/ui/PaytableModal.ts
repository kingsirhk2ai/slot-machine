import Phaser from 'phaser';
import { PAYOUTS, PAYOUT_DISPLAY_ORDER } from '../data/payouts';
import { getSymbol } from '../data/symbols';
import { enableContainerInput, makeButton } from './containerInput';
import { audio } from '../systems/AudioManager';

const DEPTH = 400;

/**
 * Paytable popup. `?` button toggles a centered modal listing every symbol
 * with its 3/4/5-match payout multipliers. Click outside or X to dismiss.
 */
export class PaytableModal {
  private container?: Phaser.GameObjects.Container;
  private isOpen = false;
  public readonly button: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, btnX: number, btnY: number) {
    this.button = this.buildButton(btnX, btnY);
  }

  private buildButton(x: number, y: number): Phaser.GameObjects.Container {
    const r = 22;
    const c = this.scene.add.container(x, y);
    c.setDepth(180);
    const g = this.scene.add.graphics();
    g.fillStyle(0x1a1a2e, 1);
    g.fillCircle(0, 0, r);
    g.lineStyle(2, 0xffd700, 1);
    g.strokeCircle(0, 0, r);
    g.lineStyle(1, 0xffd700, 0.4);
    g.strokeCircle(0, 0, r - 3);
    c.add(g);
    const t = this.scene.add
      .text(0, 0, '?', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0.5);
    c.add(t);

    c.setSize(r * 2, r * 2);
    enableContainerInput(c, new Phaser.Geom.Circle(0, 0, r), Phaser.Geom.Circle.Contains);
    c.on('pointerover', () => {
      this.scene.input.setDefaultCursor('pointer');
      this.scene.tweens.add({ targets: c, scale: 1.1, duration: 120, ease: 'Sine.Out' });
    });
    c.on('pointerout', () => {
      this.scene.input.setDefaultCursor('default');
      this.scene.tweens.add({ targets: c, scale: 1, duration: 120, ease: 'Sine.Out' });
    });
    c.on('pointerdown', () => {
      audio.play('click');
      this.toggle();
    });
    return c;
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  public open(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const MODAL_W = Math.min(720, W - 24);
    const MODAL_H = Math.min(540, H - 24);

    const container = this.scene.add.container(0, 0);
    container.setDepth(DEPTH);
    this.container = container;

    // Backdrop — click outside to close.
    const backdrop = this.scene.add.graphics();
    backdrop.fillStyle(0x000000, 0.7);
    backdrop.fillRect(0, 0, W, H);
    backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, W, H),
      Phaser.Geom.Rectangle.Contains,
    );
    backdrop.on('pointerdown', () => {
      audio.play('click');
      this.close();
    });
    container.add(backdrop);

    // Panel.
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

    // Title.
    const title = this.scene.add
      .text(cxCenter, my + 22, 'PAYTABLE', {
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0.5, 0);
    title.setShadow(0, 2, '#000000', 4, false, true);
    container.add(title);

    // Header row — scale column x positions to actual modal width.
    const scaleK = MODAL_W / 720;
    const colXs = [
      mx + 80 * scaleK,
      mx + 260 * scaleK,
      mx + 380 * scaleK,
      mx + 500 * scaleK,
      mx + 620 * scaleK,
    ];
    const headers = ['SYMBOL', 'x3', 'x4', 'x5'];
    const headerY = my + 78;
    for (let i = 0; i < headers.length; i++) {
      const isSymbol = i === 0;
      const x = isSymbol ? mx + 60 : colXs[i];
      const t = this.scene.add
        .text(x, headerY, headers[i], {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffd700',
        })
        .setOrigin(isSymbol ? 0 : 0.5, 0.5);
      container.add(t);
    }
    // Header divider.
    const div = this.scene.add.graphics();
    div.lineStyle(1, 0xffd700, 0.45);
    div.beginPath();
    div.moveTo(mx + 30, headerY + 14);
    div.lineTo(mx + MODAL_W - 30, headerY + 14);
    div.strokePath();
    container.add(div);

    // Rows.
    const rowStartY = headerY + 30;
    const rowH = 36;
    for (let i = 0; i < PAYOUT_DISPLAY_ORDER.length; i++) {
      const id = PAYOUT_DISPLAY_ORDER[i];
      const row = PAYOUTS[id];
      if (!row) continue;
      const ry = rowStartY + i * rowH;
      // alternating row stripe
      if (i % 2 === 0) {
        const stripe = this.scene.add.graphics();
        stripe.fillStyle(0xffffff, 0.03);
        stripe.fillRect(mx + 30, ry - rowH / 2, MODAL_W - 60, rowH);
        container.add(stripe);
      }

      // Symbol icon + name.
      let def;
      try {
        def = getSymbol(id);
      } catch {
        continue;
      }
      const iconSize = 26;
      if (this.scene.textures.exists(def.key)) {
        const img = this.scene.add.image(mx + 60, ry, def.key).setDisplaySize(iconSize, iconSize).setOrigin(0, 0.5);
        container.add(img);
      } else {
        const t = this.scene.add
          .text(mx + 60, ry, def.glyph, { fontSize: '22px', color: '#ffffff' })
          .setOrigin(0, 0.5);
        container.add(t);
      }

      const nameT = this.scene.add
        .text(mx + 100, ry, id, {
          fontFamily: '"Arial", sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#e8e8ff',
        })
        .setOrigin(0, 0.5);
      container.add(nameT);

      const cellVals = [row[3], row[4], row[5]];
      for (let c = 0; c < 3; c++) {
        const tv = this.scene.add
          .text(colXs[c + 1], ry, String(cellVals[c]), {
            fontFamily: '"Courier New", monospace',
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#ffd700',
          })
          .setOrigin(0.5);
        container.add(tv);
      }
    }

    // Footer hint.
    const hint = this.scene.add
      .text(cxCenter, my + MODAL_H - 28, 'Multipliers × per-line bet. Match left-to-right, 3+ in a row.', {
        fontFamily: '"Arial", sans-serif',
        fontSize: '12px',
        color: '#bcbcd6',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);
    container.add(hint);

    // Close (X) button.
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

    // Fade-in.
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
}
