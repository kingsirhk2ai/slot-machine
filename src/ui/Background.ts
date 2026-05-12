import Phaser from 'phaser';

const SPARKLE_TEXTURE = 'fx-sparkle';
const SPOT_TEXTURE = 'fx-spot';

function ensureSparkleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SPARKLE_TEXTURE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0xffffff, 0.55);
  g.fillCircle(8, 8, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 2.5);
  g.generateTexture(SPARKLE_TEXTURE, 16, 16);
  g.destroy();
}

function ensureSpotTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SPOT_TEXTURE)) return;
  const size = 256;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const steps = 14;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const r = (size / 2) * t;
    const alpha = (1 - t) * 0.18 + (1 - t) ** 3 * 0.18;
    g.fillStyle(0xffffff, alpha);
    g.fillCircle(size / 2, size / 2, r);
  }
  g.generateTexture(SPOT_TEXTURE, size, size);
  g.destroy();
}

export class Background {
  constructor(scene: Phaser.Scene, w: number, h: number) {
    ensureSparkleTexture(scene);
    ensureSpotTexture(scene);

    const base = scene.add.graphics();
    base.fillStyle(0x050410, 1);
    base.fillRect(0, 0, w, h);
    base.setDepth(0);

    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.max(w, h);

    const glow = scene.add.graphics();
    const layers: Array<[number, number, number]> = [
      [0x2a1a4a, 0.55, maxR * 0.56],
      [0x3a2266, 0.35, maxR * 0.42],
      [0x4a2e80, 0.25, maxR * 0.3],
      [0x5a3a96, 0.18, maxR * 0.19],
    ];
    for (const [color, alpha, r] of layers) {
      glow.fillStyle(color, alpha);
      glow.fillCircle(cx, cy, r);
    }
    glow.setDepth(1);

    const beamLen = maxR;
    const beamCount = 3;
    for (let i = 0; i < beamCount; i++) {
      const beam = scene.add.graphics();
      beam.fillStyle(0xffffff, 0.06);
      beam.beginPath();
      beam.moveTo(0, 0);
      beam.lineTo(-beamLen * 0.3, beamLen);
      beam.lineTo(beamLen * 0.3, beamLen);
      beam.closePath();
      beam.fillPath();
      beam.setPosition(cx, cy);
      beam.setRotation((i * Math.PI * 2) / beamCount);
      beam.setBlendMode(Phaser.BlendModes.ADD);
      beam.setDepth(2);
      scene.tweens.add({
        targets: beam,
        rotation: beam.rotation + Math.PI * 2,
        duration: 22000 + i * 5000,
        repeat: -1,
        ease: 'Linear',
      });
    }

    const cornerSpots: Array<[number, number]> = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ];
    for (let i = 0; i < cornerSpots.length; i++) {
      const [sx, sy] = cornerSpots[i];
      const spot = scene.add.image(sx, sy, SPOT_TEXTURE);
      spot.setBlendMode(Phaser.BlendModes.ADD);
      spot.setAlpha(0.55);
      spot.setTint(0xffd97a);
      spot.setScale(2.6);
      spot.setDepth(2);
      scene.tweens.add({
        targets: spot,
        scale: 2.85,
        duration: 2400 + i * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    const focus = scene.add.image(cx, cy - 30, SPOT_TEXTURE);
    focus.setBlendMode(Phaser.BlendModes.ADD);
    focus.setAlpha(0.65);
    focus.setTint(0xfff4b3);
    focus.setScale(3.4, 2.4);
    focus.setDepth(3);
    scene.tweens.add({
      targets: focus,
      scaleX: 3.55,
      scaleY: 2.5,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    const emitter = scene.add.particles(0, 0, SPARKLE_TEXTURE, {
      x: { min: 0, max: w },
      y: h + 12,
      lifespan: { min: 3200, max: 5200 },
      speedY: { min: -55, max: -25 },
      speedX: { min: -18, max: 18 },
      scale: { start: 0.55, end: 0.1 },
      alpha: { start: 0.55, end: 0 },
      tint: [0xffd700, 0xffe98a, 0xfff4b3],
      frequency: 320,
      blendMode: 'ADD',
      quantity: 1,
    });
    emitter.setDepth(4);

    const slow = scene.add.particles(0, 0, SPARKLE_TEXTURE, {
      x: { min: 0, max: w },
      y: { min: 0, max: h },
      lifespan: 2600,
      speedY: { min: -10, max: 10 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.35, end: 0 },
      tint: [0xfff4b3, 0xffe98a],
      frequency: 480,
      blendMode: 'ADD',
      quantity: 1,
    });
    slow.setDepth(4);
  }
}

export { SPARKLE_TEXTURE, SPOT_TEXTURE };
