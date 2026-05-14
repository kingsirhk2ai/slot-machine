import Phaser from 'phaser';
import { audio } from '../systems/AudioManager';
import { settings } from '../systems/Settings';
import { enableContainerInput, makeButton } from './containerInput';

const DEPTH = 400;
const GEAR_R = 22;

/**
 * Game settings drawer. Gear icon (top-right) toggles a centered modal with:
 *   • Mute toggle
 *   • SFX volume slider
 *   • BGM volume slider
 *   • Quick Spin toggle
 *
 * All changes persist via AudioManager and Settings (localStorage).
 */
export class SettingsModal {
  private container?: Phaser.GameObjects.Container;
  private isOpen = false;
  public readonly button: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, btnX: number, btnY: number) {
    this.button = this.buildGearButton(btnX, btnY);
  }

  private buildGearButton(x: number, y: number): Phaser.GameObjects.Container {
    const r = GEAR_R;
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
      .text(0, 0, '⚙', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
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
    const MODAL_W = Math.min(380, W - 24);
    const MODAL_H = Math.min(320, H - 24);

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

    const mx = (W - MODAL_W) / 2;
    const my = (H - MODAL_H) / 2;
    const cxCenter = W / 2;

    // Panel background.
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
      .text(cxCenter, my + 22, 'SETTINGS', {
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0.5, 0);
    title.setShadow(0, 2, '#000000', 4, false, true);
    container.add(title);

    // Layout grid for rows.
    const rowX = mx + 26;
    const rowW = MODAL_W - 52;
    let rowY = my + 70;
    const ROW_GAP = 50;

    // ── Mute toggle ──
    this.addToggleRow(container, rowX, rowY, rowW, 'MUTE', () => audio.isMuted(), (v) => {
      audio.setMute(v);
      if (!v) audio.startBgm();
    });
    rowY += ROW_GAP;

    // ── SFX volume slider ──
    this.addSliderRow(container, rowX, rowY, rowW, 'SFX', () => this.getSfxVol(), (v) => {
      audio.setSfxVolume(v);
    });
    rowY += ROW_GAP;

    // ── BGM volume slider ──
    this.addSliderRow(container, rowX, rowY, rowW, 'MUSIC', () => this.getBgmVol(), (v) => {
      audio.setBgmVolume(v);
    });
    rowY += ROW_GAP;

    // ── Quick Spin toggle ──
    this.addToggleRow(
      container,
      rowX,
      rowY,
      rowW,
      'QUICK SPIN',
      () => settings.isQuickSpin(),
      (v) => settings.setQuickSpin(v),
    );

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

  /** Read current SFX volume from AudioManager via its persisted prefs. */
  private getSfxVol(): number {
    return readVol('sfxVol', 0.7);
  }
  private getBgmVol(): number {
    return readVol('bgmVol', 0.35);
  }

  /** Render: [LABEL] ────────── [ON/OFF pill] across the row. */
  private addToggleRow(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    label: string,
    get: () => boolean,
    set: (v: boolean) => void,
  ): void {
    const labelT = this.scene.add
      .text(x, y, label, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0, 0.5);
    parent.add(labelT);

    const pillW = 64;
    const pillH = 28;
    const pillX = x + w - pillW / 2;
    const pillY = y;

    const wrap = makeButton(this.scene, pillX, pillY, {
      shape: 'rect',
      w: pillW,
      h: pillH,
      hoverScale: 1.08,
      pressScale: 0.94,
      onClick: () => {
        audio.play('click');
        const next = !get();
        set(next);
        redraw();
      },
    });
    parent.add(wrap);

    const bg = this.scene.add.graphics();
    const knob = this.scene.add.circle(0, 0, pillH / 2 - 3, 0xffffff);
    const stateT = this.scene.add
      .text(0, 0, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    wrap.add(bg);
    wrap.add(knob);
    wrap.add(stateT);

    const redraw = () => {
      const on = get();
      bg.clear();
      bg.fillStyle(on ? 0x4be84b : 0x444466, 1);
      bg.fillRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
      bg.lineStyle(1.5, 0xffd700, 0.85);
      bg.strokeRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
      const knobX = on ? pillW / 2 - pillH / 2 : -pillW / 2 + pillH / 2;
      this.scene.tweens.add({ targets: knob, x: knobX, duration: 140, ease: 'Sine.Out' });
      stateT.setText(on ? 'ON' : 'OFF');
      stateT.x = on ? -8 : 8;
    };
    redraw();
  }

  /** Render: [LABEL] [────●────────] across the row. */
  private addSliderRow(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    label: string,
    get: () => number,
    set: (v: number) => void,
  ): void {
    const labelT = this.scene.add
      .text(x, y, label, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0, 0.5);
    parent.add(labelT);

    const trackLeft = x + 70;
    const trackRight = x + w - 30;
    const trackY = y;
    const trackW = trackRight - trackLeft;

    // Track.
    const track = this.scene.add.graphics();
    track.fillStyle(0x222238, 1);
    track.fillRoundedRect(trackLeft, trackY - 3, trackW, 6, 3);
    track.lineStyle(1, 0xffd700, 0.5);
    track.strokeRoundedRect(trackLeft, trackY - 3, trackW, 6, 3);
    parent.add(track);

    // Fill (gold) and knob.
    const fill = this.scene.add.graphics();
    parent.add(fill);

    const knob = this.scene.add.circle(0, trackY, 9, 0xffd700);
    knob.setStrokeStyle(2, 0xffffff);
    parent.add(knob);

    // Percent label.
    const pct = this.scene.add
      .text(x + w + 4, trackY, '', {
        fontFamily: '"Courier New", monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(1, 0.5);
    pct.x = trackRight + 28;
    parent.add(pct);

    const redraw = () => {
      const v = Phaser.Math.Clamp(get(), 0, 1);
      const kx = trackLeft + trackW * v;
      knob.x = kx;
      fill.clear();
      fill.fillStyle(0xffd700, 0.9);
      fill.fillRoundedRect(trackLeft, trackY - 3, kx - trackLeft, 6, 3);
      pct.setText(`${Math.round(v * 100)}%`);
    };
    redraw();

    // Drag handling — tap on track or drag the knob.
    const hit = this.scene.add.zone(trackLeft + trackW / 2, trackY, trackW + 24, 28);
    hit.setOrigin(0.5);
    hit.setInteractive({ useHandCursor: true });
    parent.add(hit);

    const updateFromX = (px: number) => {
      const v = Phaser.Math.Clamp((px - trackLeft) / trackW, 0, 1);
      set(v);
      redraw();
    };
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      updateFromX(p.x);
    });
    hit.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      updateFromX(p.x);
    });
  }
}

/** Read a numeric audio pref from localStorage (mirrors AudioManager schema). */
function readVol(key: 'sfxVol' | 'bgmVol', fallback: number): number {
  try {
    const raw = localStorage.getItem('slot-audio-prefs');
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return typeof p[key] === 'number' ? p[key] : fallback;
  } catch {
    return fallback;
  }
}
