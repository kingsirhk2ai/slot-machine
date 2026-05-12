import Phaser from 'phaser';
import { SPARKLE_TEXTURE } from './Background';

export function createTitle(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  fontSize: number,
): Phaser.GameObjects.Text {
  const title = scene.add
    .text(centerX, centerY, '🎰  LUCKY  SLOT  🎰', {
      fontFamily: '"Impact", "Arial Black", "Helvetica Neue", sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#1a0a00',
      strokeThickness: Math.max(3, Math.round(fontSize * 0.11)),
    })
    .setOrigin(0.5)
    .setDepth(60);
  title.setShadow(0, 4, '#000000', 10, false, true);

  const gradient = title.context.createLinearGradient(0, 0, 0, title.height);
  gradient.addColorStop(0, '#fff4b3');
  gradient.addColorStop(0.5, '#ffd700');
  gradient.addColorStop(1, '#b8860b');
  title.setFill(gradient);

  const glow = scene.add
    .text(centerX, centerY, '🎰  LUCKY  SLOT  🎰', {
      fontFamily: '"Impact", "Arial Black", "Helvetica Neue", sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      color: '#ffd700',
    })
    .setOrigin(0.5)
    .setAlpha(0.35)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(59);
  glow.setScale(1.03);

  const baseY = title.y;
  scene.tweens.add({
    targets: [title, glow],
    y: baseY + 3,
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut',
  });

  const titleW = title.width;
  const titleH = title.height;
  const titleLeft = title.x - titleW / 2;
  const titleTop = title.y - titleH / 2;
  const shineBand = scene.add.graphics();
  shineBand.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0, 0.55, 0, 0);
  shineBand.fillRect(0, 0, 90, titleH + 6);
  shineBand.setBlendMode(Phaser.BlendModes.ADD);
  shineBand.setDepth(61);
  const shineMask = scene.make.graphics({ x: 0, y: 0 }, false);
  shineMask.fillStyle(0xffffff);
  shineMask.fillRoundedRect(titleLeft - 4, titleTop - 4, titleW + 8, titleH + 8, 8);
  shineBand.setMask(shineMask.createGeometryMask());
  shineBand.x = titleLeft - 90;
  shineBand.y = titleTop - 3;
  scene.tweens.add({
    targets: shineBand,
    x: titleLeft + titleW,
    duration: 1800,
    repeat: -1,
    repeatDelay: 2400,
    ease: 'Sine.InOut',
  });

  if (scene.textures.exists(SPARKLE_TEXTURE)) {
    const glintXs = [
      titleLeft + 20,
      titleLeft + titleW * 0.3,
      title.x,
      titleLeft + titleW * 0.7,
      titleLeft + titleW - 20,
    ];
    for (let i = 0; i < glintXs.length; i++) {
      const gx = glintXs[i];
      const gy = title.y + (i % 2 === 0 ? -titleH * 0.4 : titleH * 0.4);
      const glint = scene.add.image(gx, gy, SPARKLE_TEXTURE);
      glint.setBlendMode(Phaser.BlendModes.ADD);
      glint.setTint(0xffe98a);
      glint.setAlpha(0);
      glint.setScale(1.2);
      glint.setDepth(62);
      scene.tweens.add({
        targets: glint,
        alpha: { from: 0, to: 0.9 },
        scale: { from: 0.6, to: 1.6 },
        duration: 600,
        yoyo: true,
        delay: 400 + i * 540,
        repeat: -1,
        repeatDelay: 2200 + i * 300,
        ease: 'Sine.InOut',
      });
    }
  }

  return title;
}
