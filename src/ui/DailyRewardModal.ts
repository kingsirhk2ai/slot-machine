import Phaser from 'phaser';
import { audio } from '../systems/AudioManager';
import { Balance } from '../systems/Balance';
import { i18n } from '../systems/I18n';
import { dailyReward, DAILY_REWARDS, type DailyStatus } from '../systems/DailyReward';
import { haptics } from '../systems/NativeShell';
import { makeButton } from './containerInput';

const DEPTH = 415; // above SettingsModal (400) and AchievementsModal (410)
const SLOTS = DAILY_REWARDS.length; // 7-day cycle

interface DailyRewardOpts {
  /** Called after the player claims so the scene can refresh HUD/credit. */
  onClaimed: (amount: number) => void;
}

/**
 * Daily login reward popup. Shows a 7-cell strip representing the cycle;
 * already-claimed days appear as muted check marks, today's slot pulses,
 * future days are dim. One CLAIM button → adds credits + dismisses.
 *
 * If the player broke their streak (skipped a day), a small notice appears
 * above the strip explaining the reset.
 */
export class DailyRewardModal {
  private container?: Phaser.GameObjects.Container;
  private isOpen = false;

  constructor(private readonly scene: Phaser.Scene, private readonly opts: DailyRewardOpts) {}

  /** Open if today's reward is unclaimed. Returns true if the modal opened. */
  public openIfAvailable(): boolean {
    const status = dailyReward.status();
    if (!status.available) return false;
    this.openWith(status);
    return true;
  }

  private openWith(status: DailyStatus): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const MODAL_W = Math.min(440, W - 24);
    const MODAL_H = Math.min(300, H - 24);

    const container = this.scene.add.container(0, 0);
    container.setDepth(DEPTH);
    this.container = container;

    const backdrop = this.scene.add.graphics();
    backdrop.fillStyle(0x000000, 0.78);
    backdrop.fillRect(0, 0, W, H);
    backdrop.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    // Backdrop tap is intentionally a no-op — players must claim or close
    // explicitly so they don't dismiss free credits by accident.
    container.add(backdrop);

    const mx = (W - MODAL_W) / 2;
    const my = (H - MODAL_H) / 2;
    const cx = W / 2;

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
      e: Phaser.Types.Input.EventData,
    ) => e.stopPropagation());
    container.add(panel);

    // Title.
    const title = this.scene.add
      .text(cx, my + 24, i18n.t('daily-reward'), {
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffd700',
      })
      .setOrigin(0.5);
    title.setShadow(0, 2, '#000000', 4, false, true);
    container.add(title);

    // Sub: either "log in daily..." OR streak-broken notice.
    const subText = status.streakBroken
      ? i18n.t('streak-broken')
      : status.newStreak > 1
        ? i18n.t('streak-current', { n: status.newStreak })
        : i18n.t('daily-reward-sub');
    const sub = this.scene.add
      .text(cx, my + 50, subText, {
        fontFamily: '"Arial", sans-serif',
        fontSize: '12px',
        color: status.streakBroken ? '#ff8a3a' : '#bcbcd6',
      })
      .setOrigin(0.5);
    container.add(sub);

    // 7-day strip.
    this.buildStrip(container, mx, my + 78, MODAL_W, status);

    // Claim button.
    const btnW = 220;
    const btnH = 50;
    const btnY = my + MODAL_H - 38;
    const btn = makeButton(this.scene, cx, btnY, {
      shape: 'rect',
      w: btnW,
      h: btnH,
      hoverScale: 1.06,
      pressScale: 0.94,
      onClick: () => this.handleClaim(),
    });
    const bg = this.scene.add.graphics();
    bg.fillGradientStyle(0xffe98a, 0xffe98a, 0xffd700, 0xc9920a, 1);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
    bg.lineStyle(2.5, 0xfff4b3, 1);
    bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
    btn.add(bg);
    const t = this.scene.add
      .text(0, 0, `${i18n.t('claim')}  +${status.amount}`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#1a0a00',
      })
      .setOrigin(0.5);
    btn.add(t);
    container.add(btn);

    this.scene.tweens.add({
      targets: btn,
      scale: { from: 1, to: 1.04 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    container.setAlpha(0);
    this.scene.tweens.add({ targets: container, alpha: 1, duration: 220, ease: 'Sine.Out' });
  }

  private buildStrip(
    parent: Phaser.GameObjects.Container,
    mx: number,
    topY: number,
    modalW: number,
    status: DailyStatus,
  ): void {
    const padX = 22;
    const stripW = modalW - padX * 2;
    const cellGap = 6;
    const cellW = (stripW - cellGap * (SLOTS - 1)) / SLOTS;
    const cellH = 78;

    for (let i = 0; i < SLOTS; i++) {
      const cx = mx + padX + i * (cellW + cellGap) + cellW / 2;
      const cy = topY + cellH / 2;

      const isClaimedAlready = i < status.dayInCycle;
      const isToday = i === status.dayInCycle;
      const reward = DAILY_REWARDS[i];

      const cell = this.scene.add.graphics();
      const fillColor = isToday ? 0x3a3000 : isClaimedAlready ? 0x0e2a0e : 0x0a0a18;
      const strokeColor = isToday ? 0xffd700 : isClaimedAlready ? 0x4be84b : 0x33334a;
      const strokeAlpha = isToday ? 1 : isClaimedAlready ? 0.85 : 0.55;
      const strokeWidth = isToday ? 2.5 : 1.5;
      cell.fillStyle(fillColor, 0.9);
      cell.fillRoundedRect(-cellW / 2, -cellH / 2, cellW, cellH, 8);
      cell.lineStyle(strokeWidth, strokeColor, strokeAlpha);
      cell.strokeRoundedRect(-cellW / 2, -cellH / 2, cellW, cellH, 8);

      const wrap = this.scene.add.container(cx, cy);
      wrap.add(cell);

      const dayLabel = this.scene.add
        .text(0, -cellH / 2 + 12, i18n.t('streak-day', { n: i + 1 }), {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: isToday ? '#ffd700' : isClaimedAlready ? '#4be84b' : '#7a7a96',
        })
        .setOrigin(0.5);
      wrap.add(dayLabel);

      const coinIcon = this.scene.add
        .text(0, -2, isClaimedAlready ? '✓' : '🪙', {
          fontFamily: 'Arial, sans-serif',
          fontSize: isClaimedAlready ? '20px' : '22px',
          color: isClaimedAlready ? '#4be84b' : isToday ? '#ffd700' : '#7a7a96',
        })
        .setOrigin(0.5)
        .setAlpha(isToday || isClaimedAlready ? 1 : 0.55);
      wrap.add(coinIcon);

      const amount = this.scene.add
        .text(0, cellH / 2 - 14, `+${reward}`, {
          fontFamily: '"Courier New", monospace',
          fontSize: '11px',
          fontStyle: 'bold',
          color: isToday ? '#ffd700' : isClaimedAlready ? '#4be84b' : '#88889e',
        })
        .setOrigin(0.5);
      wrap.add(amount);

      // Pulse today's cell so the eye lands on it.
      if (isToday) {
        this.scene.tweens.add({
          targets: wrap,
          scale: { from: 1, to: 1.08 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }

      parent.add(wrap);
    }
  }

  private handleClaim(): void {
    const amount = dailyReward.claim();
    if (amount <= 0) {
      this.close();
      return;
    }
    audio.play('win-medium');
    haptics.success();
    Balance.add(amount);
    this.opts.onClaimed(amount);

    // "Come back tomorrow" toast above the button before fading.
    if (this.container) {
      const W = this.scene.scale.width;
      const H = this.scene.scale.height;
      const cx = W / 2;
      const flash = this.scene.add
        .text(cx, H / 2, i18n.t('come-back-tomorrow'), {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '14px',
          color: '#4be84b',
        })
        .setOrigin(0.5)
        .setDepth(DEPTH + 5);
      flash.setAlpha(0);
      this.scene.tweens.add({
        targets: flash,
        alpha: { from: 0, to: 1 },
        duration: 220,
      });
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 380,
        delay: 700,
        onComplete: () => flash.destroy(),
      });
    }
    this.scene.time.delayedCall(900, () => this.close());
  }

  public close(): void {
    if (!this.isOpen || !this.container) return;
    const c = this.container;
    this.isOpen = false;
    this.container = undefined;
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: 180,
      ease: 'Sine.In',
      onComplete: () => c.destroy(),
    });
  }
}
