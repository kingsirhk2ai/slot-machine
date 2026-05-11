import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { rng } from '../systems/RNG';
import { ReelStrip } from '../systems/ReelStrip';
import { REEL_STRIPS } from '../data/reelStrips';
import { PAYLINES, LINE_OPTIONS } from '../data/paylines';
import { BET_OPTIONS } from '../data/payouts';
import { ReelView } from '../ui/ReelView';
import { Background, SPARKLE_TEXTURE } from '../ui/Background';
import { CabinetFrame, drawReelSeparator } from '../ui/CabinetFrame';
import { SpinButton } from '../ui/SpinButton';
import { Hud } from '../ui/Hud';
import { createTitle } from '../ui/Title';
import { PaylinePanel } from '../ui/PaylinePanel';
import { Stepper } from '../ui/Stepper';
import { PaytableModal } from '../ui/PaytableModal';
import { AutoSpinController } from '../ui/AutoSpinController';
import { evaluate, totalWin, type WinLine } from '../systems/PaylineEvaluator';
import { Balance } from '../systems/Balance';
import { WinFx } from '../ui/WinFx';
import { audio } from '../systems/AudioManager';
import { MuteButton } from '../ui/MuteButton';

const NUM_REELS = 5;
const VISIBLE_ROWS = 3;
const SYMBOL_SIZE = 96;
const REEL_GAP = 8;

const DEFAULT_BET = 1;
const DEFAULT_LINES = 20;

export class MainScene extends Phaser.Scene {
  private reels: ReelView[] = [];
  private spinButton!: SpinButton;
  private spinning = false;
  private blockX = 0;
  private blockY = 0;
  private blockW = 0;
  private blockH = 0;
  private cabinet!: CabinetFrame;
  private hud!: Hud;
  private paylinePanel!: PaylinePanel;
  private autoSpin!: AutoSpinController;
  private winFx!: WinFx;

  private betPerLine = DEFAULT_BET;
  private activeLines = DEFAULT_LINES;
  private balance = 0;
  private lastWin = 0;

  constructor() {
    super({ key: 'MainScene' });
  }

  create(): void {
    this.balance = Balance.getBalance();

    audio.attach(this);
    audio.startBgm();

    new Background(this);
    createTitle(this);

    const totalReelW = NUM_REELS * SYMBOL_SIZE + (NUM_REELS - 1) * REEL_GAP;
    const blockH = VISIBLE_ROWS * SYMBOL_SIZE;
    const blockX = (GAME_WIDTH - totalReelW) / 2;
    const blockY = 140;
    this.blockX = blockX;
    this.blockY = blockY;
    this.blockW = totalReelW;
    this.blockH = blockH;

    this.cabinet = new CabinetFrame(this, blockX, blockY, totalReelW, blockH);

    for (let i = 0; i < NUM_REELS; i++) {
      const strip = new ReelStrip(REEL_STRIPS[i]);
      const rx = blockX + i * (SYMBOL_SIZE + REEL_GAP) + SYMBOL_SIZE / 2;
      const reel = new ReelView(this, rx, blockY, strip, SYMBOL_SIZE, rng);
      reel.setDepth(110);
      this.reels.push(reel);
    }

    for (let i = 1; i < NUM_REELS; i++) {
      const sx = blockX + i * SYMBOL_SIZE + (i - 1) * REEL_GAP + REEL_GAP / 2;
      drawReelSeparator(this, sx, blockY + 4, blockY + blockH - 4);
    }

    this.paylinePanel = new PaylinePanel(
      this,
      { blockX, blockY, symbolSize: SYMBOL_SIZE, reelGap: REEL_GAP, numReels: NUM_REELS },
      [...PAYLINES],
    );

    // SPIN.
    const btnY = blockY + blockH + 90;
    this.spinButton = new SpinButton(this, GAME_WIDTH / 2, btnY, () => this.handleSpin());
    this.spinButton.setDepth(150);

    // BET / LINES steppers.
    const leftX = 250;
    const betStepper = new Stepper(this, leftX, btnY - 35, {
      label: 'BET',
      values: BET_OPTIONS,
      initial: this.betPerLine,
      onChange: (v) => this.setBet(v),
    });
    betStepper.setDepth(150);

    const linesStepper = new Stepper(this, leftX, btnY + 35, {
      label: 'LINES',
      values: LINE_OPTIONS,
      initial: this.activeLines,
      onChange: (v) => this.setLines(v),
    });
    linesStepper.setDepth(150);

    // AUTO + paytable.
    const rightX = GAME_WIDTH - leftX;
    this.autoSpin = new AutoSpinController(this, rightX, btnY - 35, {
      spin: () => this.handleSpin(),
      isSpinning: () => this.spinning,
      canSpin: () => this.balance >= this.betPerLine * this.activeLines,
    });
    new PaytableModal(this, rightX, btnY + 35);

    // HUD.
    this.hud = new Hud(this, GAME_HEIGHT - 80);
    this.refreshHud(true);

    // Mute toggle — top-right corner of the canvas.
    new MuteButton(this, GAME_WIDTH - 38, 38);

    const creditCenter = this.hud.panelCenter('CREDIT') ?? { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 60 };
    this.winFx = new WinFx(
      this,
      { blockX, blockY, blockW: totalReelW, blockH, symbolSize: SYMBOL_SIZE, reelGap: REEL_GAP },
      creditCenter,
    );

    // Preview the paylines as soon as the scene boots so the player sees what
    // they're betting on.
    this.paylinePanel.showPreview(this.activeLines);
  }

  // ---------- state ----------

  private setBet(v: number): void {
    this.betPerLine = v;
    this.refreshHud();
  }

  private setLines(v: number): void {
    this.activeLines = v;
    this.paylinePanel.clearWins();
    this.paylinePanel.showPreview(this.activeLines);
    this.refreshHud();
  }

  private refreshHud(snap = false): void {
    const total = this.betPerLine * this.activeLines;
    if (snap) {
      this.hud.setValue('CREDIT', this.balance);
      this.hud.setValue('BET', this.betPerLine);
      this.hud.setValue('LINES', this.activeLines);
      this.hud.setValue('TOTAL BET', total);
      this.hud.setValue('WIN', this.lastWin);
      return;
    }
    this.hud.setValue('BET', this.betPerLine);
    this.hud.setValue('LINES', this.activeLines);
    this.hud.setValue('TOTAL BET', total);
    this.hud.pulseValue('BET');
    this.hud.pulseValue('LINES');
    this.hud.pulseValue('TOTAL BET');
  }

  // ---------- spin ----------

  private handleSpin(): void {
    if (this.spinning) return;
    const totalBet = this.betPerLine * this.activeLines;
    if (this.balance < totalBet) {
      this.indicateInsufficient();
      return;
    }

    this.spinning = true;
    this.spinButton.setDisabled(true);
    this.paylinePanel.clearWins();

    audio.play('spin-start');
    audio.play('reel-loop', { loop: true, volume: 0.7 });

    // Deduct bet.
    Balance.deduct(totalBet);
    const beforeBalance = this.balance;
    this.balance = Balance.getBalance();
    this.hud.countTo('CREDIT', this.balance, 400);
    void beforeBalance;

    // Reset WIN.
    this.lastWin = 0;
    this.hud.setValue('WIN', 0);

    let finished = 0;
    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      const stop = reel.strip.pickStopIndex(rng);
      const duration = 1200 + i * 250;
      reel.spinTo(stop, duration, () => {
        const isFinal = i === this.reels.length - 1;
        if (isFinal) {
          audio.stop('reel-loop');
          audio.play('reel-stop-final');
        } else {
          audio.play('reel-stop');
        }
        this.playReelStopFx(i);
        finished++;
        if (finished === this.reels.length) {
          this.onAllReelsStopped();
        }
      });
    }
  }

  private onAllReelsStopped(): void {
    // Build [col][row] result grid from each reel.
    const result: string[][] = this.reels.map((r) => r.getVisibleSymbols());
    const wins: WinLine[] = evaluate(result, [...PAYLINES], this.activeLines, this.betPerLine);
    const winSum = totalWin(wins);

    // Debug telemetry.
    console.log('[spin] result =', result);
    console.log('[spin] wins =', wins, 'totalWin =', winSum);

    const totalBet = this.betPerLine * this.activeLines;
    if (wins.length > 0) {
      this.paylinePanel.showWins(wins, (w) => this.winFx.floatLineAmount(w));
      Balance.add(winSum);
      this.balance = Balance.getBalance();
      this.lastWin = winSum;

      const isBig = winSum >= totalBet * 10;
      const isMedium = !isBig && (winSum >= totalBet * 3 || wins.length >= 3);
      const countDuration = isBig ? 1400 : 1000;
      this.hud.countTo('WIN', winSum, countDuration);
      this.hud.countTo('CREDIT', this.balance, countDuration);
      this.hud.pulseValue('WIN');
      this.hud.pulsePanel('CREDIT');
      this.hud.pulsePanel('WIN');

      if (isBig) audio.play('win-big');
      else if (isMedium) audio.play('win-medium');
      else audio.play('win-small');

      this.winFx.centerBadge(winSum);
      this.winFx.coinBurst(isBig ? 40 : 28);

      if (isBig) {
        this.playBigWin(winSum);
        this.winFx.confettiShower();
      }

      window.dispatchEvent(
        new CustomEvent('slot:win', { detail: { amount: winSum, lines: wins.length, isBig } }),
      );
    }

    this.spinning = false;
    this.spinButton.setDisabled(false);
    this.autoSpin.onSpinComplete();

    // Show the active payline preview again once highlights settle.
    if (wins.length === 0) {
      this.paylinePanel.showPreview(this.activeLines);
    } else {
      // Keep the win-cycling visible but layer the preview faintly under it.
      this.paylinePanel.showPreview(this.activeLines);
    }
  }

  private indicateInsufficient(): void {
    audio.play('error');
    this.hud.flashError('CREDIT');
    const t = this.add
      .text(GAME_WIDTH / 2, this.blockY + this.blockH + 30, 'INSUFFICIENT CREDITS', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ff4455',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(220);
    t.setShadow(0, 2, '#000000', 6, false, true);
    this.tweens.add({
      targets: t,
      alpha: { from: 1, to: 0 },
      y: t.y - 30,
      duration: 500,
      ease: 'Sine.Out',
      onComplete: () => t.destroy(),
    });
    this.autoSpin.stop();
  }

  private playBigWin(amount: number): void {
    this.cameras.main.shake(640, 0.008);
    const label = this.add
      .text(GAME_WIDTH / 2, this.blockY + this.blockH / 2 - 80, `BIG WIN  +${amount}`, {
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#1a0a00',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(250);
    label.setShadow(0, 6, '#000000', 12, false, true);
    label.setScale(0.4);
    this.tweens.add({
      targets: label,
      scale: 1,
      duration: 280,
      ease: 'Back.Out',
    });
    this.tweens.add({
      targets: label,
      y: label.y - 80,
      alpha: { from: 1, to: 0 },
      duration: 1600,
      delay: 3000,
      ease: 'Sine.Out',
      onComplete: () => label.destroy(),
    });

    if (this.textures.exists(SPARKLE_TEXTURE)) {
      const burst = this.add.particles(GAME_WIDTH / 2, this.blockY + this.blockH / 2, SPARKLE_TEXTURE, {
        speed: { min: 220, max: 380 },
        angle: { min: 0, max: 360 },
        lifespan: 1200,
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffd700, 0xfff4b3, 0xffe98a],
        blendMode: 'ADD',
        emitting: false,
      });
      burst.setDepth(240);
      burst.explode(80);
      this.time.delayedCall(1600, () => burst.destroy());
    }
  }

  private playReelStopFx(reelIndex: number): void {
    const reelX = this.blockX + reelIndex * (SYMBOL_SIZE + REEL_GAP);
    const reelCenterX = reelX + SYMBOL_SIZE / 2;
    const reelCenterY = this.blockY + this.blockH / 2;

    const flash = this.add.graphics();
    flash.setDepth(130);
    flash.fillStyle(0xffffff, 0.5);
    flash.fillRoundedRect(reelX, this.blockY, SYMBOL_SIZE, this.blockH, 8);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      ease: 'Sine.Out',
      onComplete: () => flash.destroy(),
    });

    const pop = this.add.graphics();
    pop.setDepth(131);
    pop.setBlendMode(Phaser.BlendModes.ADD);
    pop.fillStyle(0xffffff, 1);
    pop.fillCircle(0, 0, 18);
    pop.setPosition(reelCenterX, reelCenterY);
    pop.setScale(0.2);
    this.tweens.add({
      targets: pop,
      scale: 2.2,
      alpha: 0,
      duration: 260,
      ease: 'Sine.Out',
      onComplete: () => pop.destroy(),
    });

    this.reels[reelIndex].flashTint(0xfff5cc, 110);

    const px = reelCenterX;
    const py = this.blockY + this.blockH - 4;
    const burst = this.add.particles(px, py, SPARKLE_TEXTURE, {
      speed: { min: 100, max: 200 },
      angle: { min: 200, max: 340 },
      lifespan: 460,
      scale: { start: 0.75, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd700, 0xfff4b3, 0xffe98a],
      blendMode: 'ADD',
      emitting: false,
    });
    burst.setDepth(140);
    burst.explode(14);
    this.time.delayedCall(800, () => burst.destroy());

    if (reelIndex === this.reels.length - 1) {
      this.cameras.main.shake(200, 0.005);

      const halo = this.cabinet.handles.halo;
      this.tweens.add({
        targets: halo,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 180,
        yoyo: true,
        ease: 'Sine.Out',
      });

      const ring = this.add.graphics();
      ring.setDepth(141);
      ring.setBlendMode(Phaser.BlendModes.ADD);
      ring.lineStyle(3, 0xffd700, 1);
      ring.strokeRoundedRect(
        -this.blockW / 2 - 12,
        -this.blockH / 2 - 12,
        this.blockW + 24,
        this.blockH + 24,
        18,
      );
      ring.setPosition(this.blockX + this.blockW / 2, this.blockY + this.blockH / 2);
      ring.setScale(1);
      ring.setAlpha(0.7);
      this.tweens.add({
        targets: ring,
        scale: 1.3,
        alpha: 0,
        duration: 700,
        ease: 'Sine.Out',
        onComplete: () => ring.destroy(),
      });
    }
  }
}
