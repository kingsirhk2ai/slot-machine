import Phaser from 'phaser';

export type SpinTier = 'mega' | 'big' | 'medium' | 'small' | 'none';

const TIER_COLOR: Record<SpinTier, number> = {
  mega: 0xffd700,    // gold
  big: 0xff8a3a,     // orange
  medium: 0xffe14a,  // yellow
  small: 0x4be84b,   // green
  none: 0x33334a,    // gray (loss)
};

const TIER_GLOW: Partial<Record<SpinTier, number>> = {
  mega: 0xffd700,
  big: 0xff8a3a,
  medium: 0xffe14a,
};

const SLOTS = 5;
const DOT_R = 4;
const DOT_GAP = 7;

/**
 * Compact "last 5 spins" indicator. Each spin's tier is recorded; the row
 * shows the 5 most recent as colored dots (oldest left, newest right). Loss
 * spins render as a hollow gray dot. Wins glow softly.
 */
export class SpinHistory extends Phaser.GameObjects.Container {
  private readonly slots: Phaser.GameObjects.Arc[] = [];
  private readonly halos: Phaser.GameObjects.Arc[] = [];
  private history: SpinTier[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);

    const padX = 8;
    const padY = 6;
    const totalW = SLOTS * DOT_R * 2 + (SLOTS - 1) * DOT_GAP;
    const bgW = totalW + padX * 2 + 32; // extra room for "LAST" label
    const bgH = DOT_R * 2 + padY * 2;

    // Pill background.
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a0a18, 0.85);
    bg.fillRoundedRect(-bgW / 2, -bgH / 2, bgW, bgH, bgH / 2);
    bg.lineStyle(1, 0xffd700, 0.7);
    bg.strokeRoundedRect(-bgW / 2, -bgH / 2, bgW, bgH, bgH / 2);
    this.add(bg);

    // "LAST" label, left side.
    const label = scene.add
      .text(-bgW / 2 + padX, 0, 'LAST', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0, 0.5);
    this.add(label);

    // Dots — anchor to right edge so newest sits closest to the edge.
    const dotsRight = bgW / 2 - padX;
    const startX = dotsRight - totalW + DOT_R;
    for (let i = 0; i < SLOTS; i++) {
      const dx = startX + i * (DOT_R * 2 + DOT_GAP);
      // Halo layer (additive) — invisible until a tier with glow is set.
      const halo = scene.add.circle(dx, 0, DOT_R + 3, 0xffd700, 0);
      halo.setBlendMode(Phaser.BlendModes.ADD);
      this.add(halo);
      this.halos.push(halo);

      const dot = scene.add.circle(dx, 0, DOT_R, TIER_COLOR.none, 0);
      dot.setStrokeStyle(1, 0xffffff, 0.35);
      this.add(dot);
      this.slots.push(dot);
    }

    this.setDepth(170);
  }

  /** Push a new tier; oldest entry drops off when length exceeds SLOTS. */
  public record(tier: SpinTier): void {
    this.history.push(tier);
    if (this.history.length > SLOTS) this.history.shift();
    this.refresh();
    // Pulse the newest dot.
    const newestIdx = this.history.length - 1;
    const dot = this.slots[newestIdx];
    if (dot) {
      this.scene.tweens.add({
        targets: dot,
        scale: { from: 0.4, to: 1 },
        duration: 220,
        ease: 'Back.Out',
      });
    }
  }

  private refresh(): void {
    for (let i = 0; i < SLOTS; i++) {
      const tier = this.history[i] ?? null;
      const dot = this.slots[i];
      const halo = this.halos[i];
      if (!tier) {
        dot.setFillStyle(TIER_COLOR.none, 0); // hollow
        halo.setFillStyle(0x000000, 0);
        continue;
      }
      dot.setFillStyle(TIER_COLOR[tier], 1);
      const glow = TIER_GLOW[tier];
      if (glow !== undefined) {
        halo.setFillStyle(glow, 0.35);
      } else {
        halo.setFillStyle(0x000000, 0);
      }
    }
  }
}
