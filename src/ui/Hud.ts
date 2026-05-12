import Phaser from 'phaser';

interface PanelSpec {
  label: string;
  value: string;
  valueColor: string;
}

export interface HudUpdate {
  credit?: number;
  bet?: number;
  lines?: number;
  totalBet?: number;
  win?: number;
}

export interface HudLayout {
  centerX: number;
  topY: number;
  panelW: number;
  panelH: number;
  gap: number;
  labelFontPx?: number;
  valueFontPx?: number;
}

export class Hud {
  public readonly values: Record<string, Phaser.GameObjects.Text> = {};
  private readonly panelCenters: Record<string, { x: number; y: number }> = {};
  private readonly panelContainers: Record<string, Phaser.GameObjects.Container> = {};
  private readonly tweenTargets: Record<string, { v: number }> = {};
  private activeTweens: Record<string, Phaser.Tweens.Tween | undefined> = {};
  private readonly specs: PanelSpec[];
  private readonly panelW: number;
  private readonly panelH: number;

  constructor(scene: Phaser.Scene, layout: HudLayout) {
    this.specs = [
      { label: 'CREDIT',    value: '1000', valueColor: '#4be84b' },
      { label: 'BET',       value: '1',    valueColor: '#4be84b' },
      { label: 'LINES',     value: '1',    valueColor: '#4be84b' },
      { label: 'TOTAL BET', value: '1',    valueColor: '#ffae3a' },
      { label: 'WIN',       value: '0',    valueColor: '#ffd700' },
    ];
    this.panelW = layout.panelW;
    this.panelH = layout.panelH;

    const totalW = this.panelW * this.specs.length + layout.gap * (this.specs.length - 1);
    const startX = layout.centerX - totalW / 2;
    const labelPx = layout.labelFontPx ?? Math.max(9, Math.round(this.panelW * 0.085));
    const valuePx = layout.valueFontPx ?? Math.max(14, Math.round(this.panelW * 0.16));

    for (let i = 0; i < this.specs.length; i++) {
      const px = startX + i * (this.panelW + layout.gap);
      this.drawPanel(scene, px, layout.topY, this.specs[i], labelPx, valuePx);
    }
  }

  setValue(label: string, n: number): void {
    const t = this.values[label];
    if (!t) return;
    t.setText(String(Math.max(0, Math.floor(n))));
    this.tweenTargets[label] = { v: n };
    this.activeTweens[label]?.stop();
    this.activeTweens[label] = undefined;
  }

  countTo(label: string, target: number, durationMs = 800): void {
    const t = this.values[label];
    if (!t) return;
    const state = this.tweenTargets[label] ?? { v: Number(t.text) || 0 };
    this.tweenTargets[label] = state;
    this.activeTweens[label]?.stop();

    const tween = t.scene.tweens.add({
      targets: state,
      v: target,
      duration: durationMs,
      ease: 'Cubic.Out',
      onUpdate: () => {
        t.setText(String(Math.round(state.v)));
      },
      onComplete: () => {
        t.setText(String(Math.round(target)));
        state.v = target;
        this.activeTweens[label] = undefined;
      },
    });
    this.activeTweens[label] = tween;
  }

  pulseValue(label: string): void {
    const val = this.values[label];
    if (!val) return;
    const scene = val.scene;
    scene.tweens.add({
      targets: val,
      scale: { from: 1, to: 1.12 },
      duration: 120,
      yoyo: true,
      ease: 'Sine.InOut',
    });
  }

  flashError(label: string): void {
    const val = this.values[label];
    if (!val) return;
    const origColor = val.style.color as string;
    val.setColor('#ff4455');
    val.scene.time.delayedCall(500, () => val.setColor(origColor));
  }

  panelCenter(label: string): { x: number; y: number } | null {
    return this.panelCenters[label] ?? null;
  }

  pulsePanel(label: string): void {
    const wrap = this.panelContainers[label];
    if (!wrap) return;
    wrap.scene.tweens.add({
      targets: wrap,
      scale: { from: 1, to: 1.1 },
      duration: 180,
      yoyo: true,
      ease: 'Sine.InOut',
    });

    const center = this.panelCenters[label];
    if (!center) return;
    const flash = wrap.scene.add.graphics();
    flash.setDepth(160);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.fillStyle(0xffd700, 0.5);
    flash.fillRoundedRect(center.x - this.panelW / 2, center.y - this.panelH / 2, this.panelW, this.panelH, 8);
    wrap.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 380,
      ease: 'Sine.Out',
      onComplete: () => flash.destroy(),
    });
  }

  private drawPanel(
    scene: Phaser.Scene,
    x: number,
    y: number,
    spec: PanelSpec,
    labelPx: number,
    valuePx: number,
  ): void {
    const cx = x + this.panelW / 2;
    const cy = y + this.panelH / 2;
    const wrap = scene.add.container(cx, cy);
    wrap.setDepth(150);

    const g = scene.add.graphics();
    g.fillGradientStyle(0x0a0a18, 0x0a0a18, 0x05050c, 0x05050c, 1);
    g.fillRoundedRect(-this.panelW / 2, -this.panelH / 2, this.panelW, this.panelH, 8);
    g.lineStyle(2, 0xffd700, 1);
    g.strokeRoundedRect(-this.panelW / 2, -this.panelH / 2, this.panelW, this.panelH, 8);
    g.lineStyle(1, 0xffd700, 0.3);
    g.strokeRoundedRect(-this.panelW / 2 + 3, -this.panelH / 2 + 3, this.panelW - 6, this.panelH - 6, 6);
    g.fillStyle(0x000000, 0.45);
    g.fillRect(-this.panelW / 2 + 4, -this.panelH / 2 + 4, this.panelW - 8, 4);
    wrap.add(g);

    const labelText = scene.add
      .text(0, -this.panelH / 2 + 5, spec.label, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: `${labelPx}px`,
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0.5, 0);
    wrap.add(labelText);

    const val = scene.add
      .text(0, this.panelH / 2 - 5, spec.value, {
        fontFamily: '"Courier New", "Menlo", monospace',
        fontSize: `${valuePx}px`,
        fontStyle: 'bold',
        color: spec.valueColor,
      })
      .setOrigin(0.5, 1);
    val.setShadow(0, 0, spec.valueColor, 6, false, true);
    wrap.add(val);

    this.values[spec.label] = val;
    this.tweenTargets[spec.label] = { v: Number(spec.value) || 0 };
    this.panelCenters[spec.label] = { x: cx, y: cy };
    this.panelContainers[spec.label] = wrap;

    const scan = scene.add.graphics();
    const ledTop = -this.panelH / 2 + labelPx + 8;
    const ledH = this.panelH - (labelPx + 12);
    scan.fillStyle(0x000000, 0.18);
    for (let yy = ledTop; yy < ledTop + ledH; yy += 3) {
      scan.fillRect(-this.panelW / 2 + 6, yy, this.panelW - 12, 1);
    }
    wrap.add(scan);
  }
}
