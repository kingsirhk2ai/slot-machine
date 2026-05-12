import Phaser from 'phaser';
import { SPARKLE_TEXTURE } from './Background';
import { enableContainerInput } from './containerInput';
import { audio } from '../systems/AudioManager';

export class SpinButton extends Phaser.GameObjects.Container {
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly bodyGroup: Phaser.GameObjects.Container;
  private glowTween?: Phaser.Tweens.Tween;
  private breathTween?: Phaser.Tweens.Tween;
  private disabled = false;
  private readonly onClick: () => void;
  private readonly RADIUS: number;

  constructor(scene: Phaser.Scene, x: number, y: number, onClick: () => void, radius: number = 60) {
    super(scene, x, y);
    this.onClick = onClick;
    this.RADIUS = radius;
    const RADIUS = radius;

    // Pulsing outer glow ring.
    this.glow = scene.add.graphics();
    this.glow.fillStyle(0xffd700, 1);
    this.glow.fillCircle(0, 0, RADIUS);
    this.glow.setAlpha(0.5);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.glow);

    // Multi-layer 3D body.
    this.bodyGroup = scene.add.container(0, 0);
    const bodyG = scene.add.graphics();
    // Outer ring: dark gold base.
    bodyG.fillStyle(0x5a3f06, 1);
    bodyG.fillCircle(0, 0, RADIUS);
    // Middle ring: bright gold gradient (approximated with stacked circles).
    bodyG.fillStyle(0xb8860b, 1);
    bodyG.fillCircle(0, 0, RADIUS - 4);
    bodyG.fillStyle(0xd8a93a, 1);
    bodyG.fillCircle(0, 0, RADIUS - 8);
    // Inner disc: bright gold radial gradient.
    bodyG.fillStyle(0xe6c45e, 1);
    bodyG.fillCircle(0, 0, RADIUS - 16);
    bodyG.fillStyle(0xf2d574, 1);
    bodyG.fillCircle(-RADIUS * 0.1, -RADIUS * 0.1, RADIUS - 22);
    bodyG.fillStyle(0xfff4b3, 1);
    bodyG.fillCircle(-RADIUS * 0.18, -RADIUS * 0.18, RADIUS - 30);
    this.bodyGroup.add(bodyG);

    // Bottom shadow ellipse — dark on bottom 30%.
    const bottomShadow = scene.add.graphics();
    bottomShadow.fillStyle(0x000000, 0.3);
    bottomShadow.fillEllipse(0, RADIUS * 0.45, RADIUS * 1.45, RADIUS * 0.45);
    this.bodyGroup.add(bottomShadow);

    // Top highlight ellipse — bright on top 40%.
    const topHighlight = scene.add.graphics();
    topHighlight.fillStyle(0xffffff, 0.55);
    topHighlight.fillEllipse(0, -RADIUS * 0.4, RADIUS * 1.4, RADIUS * 0.6);
    topHighlight.setBlendMode(Phaser.BlendModes.ADD);
    this.bodyGroup.add(topHighlight);

    // Ring strokes for crisper border.
    const ring = scene.add.graphics();
    ring.lineStyle(6, 0xf5d76e, 1);
    ring.strokeCircle(0, 0, RADIUS - 3);
    ring.lineStyle(2, 0x996515, 1);
    ring.strokeCircle(0, 0, RADIUS - 7);
    this.bodyGroup.add(ring);

    // Lower rim arc (subtle).
    const rim = scene.add.graphics();
    rim.lineStyle(3, 0xffffff, 0.35);
    rim.beginPath();
    rim.arc(0, 0, RADIUS - 12, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
    rim.strokePath();
    this.bodyGroup.add(rim);

    this.add(this.bodyGroup);

    // SPIN text.
    const labelPx = Math.max(20, Math.round(RADIUS * 0.55));
    this.label = scene.add
      .text(0, 0, 'SPIN', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: `${labelPx}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: Math.max(3, Math.round(labelPx * 0.12)),
      })
      .setOrigin(0.5);
    this.label.setShadow(0, 2, '#000000', 4, false, true);
    this.add(this.label);

    // Hit area.
    this.setSize(RADIUS * 2, RADIUS * 2);
    enableContainerInput(
      this,
      new Phaser.Geom.Circle(0, 0, RADIUS),
      Phaser.Geom.Circle.Contains,
    );
    scene.input.setDefaultCursor('default');

    this.on('pointerover', () => {
      if (this.disabled) return;
      this.scene.tweens.add({
        targets: this.bodyGroup,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 120,
        ease: 'Sine.Out',
      });
      this.scene.input.setDefaultCursor('pointer');
    });
    this.on('pointerout', () => {
      this.scene.tweens.add({
        targets: this.bodyGroup,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 120,
        ease: 'Sine.Out',
      });
      this.scene.input.setDefaultCursor('default');
    });
    this.on('pointerdown', () => {
      if (this.disabled) return;
      audio.play('click');
      this.scene.tweens.add({
        targets: this.bodyGroup,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 80,
        ease: 'Sine.Out',
      });
      this.flash();
      this.emitPressSparkles();
      this.onClick();
    });
    this.on('pointerup', () => {
      if (this.disabled) return;
      this.scene.tweens.add({
        targets: this.bodyGroup,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 120,
        ease: 'Sine.Out',
      });
    });

    this.startGlowTween();
    this.startBreath();
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  private startGlowTween(): void {
    this.glow.setScale(1);
    this.glow.setAlpha(0.5);
    this.glowTween = this.scene.tweens.add({
      targets: this.glow,
      scaleX: 1.18,
      scaleY: 1.18,
      alpha: 0,
      duration: 1200,
      yoyo: false,
      repeat: -1,
      ease: 'Sine.Out',
    });
  }

  private startBreath(): void {
    this.breathTween?.stop();
    this.breathTween = this.scene.tweens.add({
      targets: this.bodyGroup,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private flash(): void {
    const f = this.scene.add.graphics();
    f.fillStyle(0xffffff, 0.7);
    f.fillCircle(0, 0, this.RADIUS);
    f.setBlendMode(Phaser.BlendModes.ADD);
    this.add(f);
    this.scene.tweens.add({
      targets: f,
      alpha: 0,
      duration: 240,
      ease: 'Sine.Out',
      onComplete: () => f.destroy(),
    });
  }

  private emitPressSparkles(): void {
    if (!this.scene.textures.exists(SPARKLE_TEXTURE)) return;
    const worldX = this.x;
    const worldY = this.y;
    const emitter = this.scene.add.particles(worldX, worldY, SPARKLE_TEXTURE, {
      speed: { min: 120, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: 480,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd700, 0xfff4b3, 0xffe98a],
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(160);
    emitter.explode(12);
    this.scene.time.delayedCall(700, () => emitter.destroy());
  }

  setDisabled(d: boolean): void {
    if (this.disabled === d) return;
    this.disabled = d;
    if (d) {
      this.glowTween?.stop();
      this.glowTween = undefined;
      this.breathTween?.stop();
      this.breathTween = undefined;
      this.glow.setAlpha(0);
      this.bodyGroup.setAlpha(0.55);
      this.label.setAlpha(0.7);
      this.label.setText('SPINNING');
      this.scene.input.setDefaultCursor('default');
    } else {
      this.bodyGroup.setAlpha(1);
      this.label.setAlpha(1);
      this.label.setText('SPIN');
      this.bodyGroup.setScale(1);
      this.startGlowTween();
      this.startBreath();
    }
  }
}
