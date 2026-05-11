import Phaser from 'phaser';
import { audio } from '../systems/AudioManager';
import { makeButton } from './containerInput';

const SIZE = 28;

/**
 * Mute / unmute toggle. Renders a 🔊 / 🔇 glyph inside a circular gold button.
 * Click toggles the audio mute preference (persisted to localStorage).
 */
export class MuteButton {
  public readonly container: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = makeButton(scene, x, y, {
      shape: 'circle',
      radius: SIZE,
      hoverScale: 1.1,
      pressScale: 0.92,
      onClick: () => this.toggle(),
    });
    this.container.setDepth(250);

    const g = scene.add.graphics();
    g.fillStyle(0x1a1a2e, 0.85);
    g.fillCircle(0, 0, SIZE);
    g.lineStyle(2, 0xffd700, 1);
    g.strokeCircle(0, 0, SIZE);
    g.lineStyle(1, 0xffd700, 0.35);
    g.strokeCircle(0, 0, SIZE - 4);
    this.container.add(g);

    this.label = scene.add
      .text(0, 0, audio.isMuted() ? '🔇' : '🔊', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
      })
      .setOrigin(0.5);
    this.container.add(this.label);
  }

  private toggle(): void {
    const next = !audio.isMuted();
    audio.setMute(next);
    this.label.setText(next ? '🔇' : '🔊');
    // Re-start BGM if user unmuted (it was paused via scene.sound.mute).
    if (!next) {
      audio.startBgm();
    }
  }
}
