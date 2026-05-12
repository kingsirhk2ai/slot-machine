import Phaser from 'phaser';
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
const REEL_GAP = 6;

const DEFAULT_BET = 1;
const DEFAULT_LINES = 20;

interface LayoutDims {
  w: number;
  h: number;
  portrait: boolean;
  symbolSize: number;
  blockX: number;
  blockY: number;
  blockW: number;
  blockH: number;
  spinRadius: number;
}

export class MainScene extends Phaser.Scene {
  private reels: ReelView[] = [];
  private spinButton!: SpinButton;
  private spinning = false;
  private blockX = 0;
  private blockY = 0;
  private blockW = 0;
  private blockH = 0;
  private symbolSize = 96;
  private cabinet!: CabinetFrame;
  private hud!: Hud;
  private paylinePanel!: PaylinePanel;
  private autoSpin!: AutoSpinController;
  private winFx!: WinFx;

  private betPerLine = DEFAULT_BET;
  private activeLines = DEFAULT_LINES;
  private balance = 0;
  private lastWin = 0;

  private resizeTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'MainScene' });
  }

  create(): void {
    this.balance = Balance.getBalance();

    audio.attach(this);
    audio.startBgm();

    this.buildLayout();

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.resizeTimer?.remove();
    });
  }

  private onResize = (): void => {
    this.resizeTimer?.remove();
    this.resizeTimer = this.time.delayedCall(150, () => {
      if (this.scene.isActive('MainScene')) this.scene.restart();
    });
  };

  private computeLayout(): LayoutDims {
    const w = this.scale.width;
    const h = this.scale.height;
    const portrait = h > w;

    // Vertical budget split: title | HUD | reels | SPIN-row.
    const titleSpace = portrait ? Math.max(54, h * 0.055) : Math.max(36, h * 0.075);
    const hudSpace = portrait ? Math.max(60, h * 0.075) : Math.max(48, h * 0.11);

    // SPIN button radius (also used as bottom reserve in landscape).
    const spinRadius = portrait
      ? Math.max(54, Math.min(78, w * 0.18))
      : Math.max(46, Math.min(72, h * 0.14));
    const bottomReserve = portrait ? 0 : spinRadius * 2 + 24;

    const reelHeightBudget = h - titleSpace - hudSpace - bottomReserve - 24;
    const maxByHeight = reelHeightBudget / VISIBLE_ROWS;

    const maxByWidth = portrait
      ? (w * 0.94 - (NUM_REELS - 1) * REEL_GAP) / NUM_REELS
      : (w * 0.6 - (NUM_REELS - 1) * REEL_GAP) / NUM_REELS;

    let symbolSize = Math.floor(Math.min(maxByWidth, maxByHeight));
    symbolSize = Math.max(42, Math.min(symbolSize, 140));

    const blockW = NUM_REELS * symbolSize + (NUM_REELS - 1) * REEL_GAP;
    const blockH = VISIBLE_ROWS * symbolSize;
    const blockX = Math.floor((w - blockW) / 2);
    const blockY = Math.floor(titleSpace + hudSpace + 8);

    return { w, h, portrait, symbolSize, blockX, blockY, blockW, blockH, spinRadius };
  }

  private buildLayout(): void {
    const L = this.computeLayout();
    this.blockX = L.blockX;
    this.blockY = L.blockY;
    this.blockW = L.blockW;
    this.blockH = L.blockH;
    this.symbolSize = L.symbolSize;

    new Background(this, L.w, L.h);

    // Title.
    const titleSize = L.portrait
      ? Math.max(24, Math.min(34, Math.floor(L.w / 13)))
      : Math.max(28, Math.min(56, Math.floor(L.w / 24)));
    const titleY = L.portrait ? Math.max(24, L.h * 0.04) + titleSize / 2 : 56;
    createTitle(this, L.w / 2, titleY, titleSize);

    // HUD panel sizing.
    const panelCount = 5;
    let panelW: number;
    let panelH: number;
    let panelGap: number;
    let hudCenterY: number;
    if (L.portrait) {
      panelGap = 4;
      panelW = Math.min(80, (L.w - 12 - panelGap * (panelCount - 1)) / panelCount);
      panelH = Math.max(42, Math.min(54, panelW * 0.62));
      hudCenterY = titleY + titleSize / 2 + panelH / 2 + 8;
    } else {
      panelGap = 16;
      panelW = Math.min(168, (L.w * 0.75 - panelGap * (panelCount - 1)) / panelCount);
      panelH = Math.max(48, Math.min(64, panelW * 0.34));
      hudCenterY = titleY + panelH / 2 + 30;
    }
    this.hud = new Hud(this, {
      centerX: L.w / 2,
      topY: hudCenterY - panelH / 2,
      panelW,
      panelH,
      gap: panelGap,
    });

    // Cabinet + reels.
    this.cabinet = new CabinetFrame(this, L.blockX, L.blockY, L.blockW, L.blockH);

    for (let i = 0; i < NUM_REELS; i++) {
      const strip = new ReelStrip(REEL_STRIPS[i]);
      const rx = L.blockX + i * (L.symbolSize + REEL_GAP) + L.symbolSize / 2;
      const reel = new ReelView(this, rx, L.blockY, strip, L.symbolSize, rng);
      reel.setDepth(110);
      this.reels.push(reel);
    }

    for (let i = 1; i < NUM_REELS; i++) {
      const sx = L.blockX + i * L.symbolSize + (i - 1) * REEL_GAP + REEL_GAP / 2;
      drawReelSeparator(this, sx, L.blockY + 4, L.blockY + L.blockH - 4);
    }

    this.paylinePanel = new PaylinePanel(
      this,
      { blockX: L.blockX, blockY: L.blockY, symbolSize: L.symbolSize, reelGap: REEL_GAP, numReels: NUM_REELS },
      [...PAYLINES],
    );

    // Controls area beneath reels.
    const reelsBottom = L.blockY + L.blockH;
    if (L.portrait) {
      this.buildPortraitControls(L, reelsBottom);
    } else {
      this.buildLandscapeControls(L, reelsBottom);
    }

    this.refreshHud(true);

    // Mute toggle — top-right corner.
    const muteOffset = L.portrait ? 28 : 38;
    new MuteButton(this, L.w - muteOffset, muteOffset);

    const creditCenter = this.hud.panelCenter('CREDIT') ?? { x: L.w / 2, y: L.h - 60 };
    this.winFx = new WinFx(
      this,
      {
        blockX: L.blockX,
        blockY: L.blockY,
        blockW: L.blockW,
        blockH: L.blockH,
        symbolSize: L.symbolSize,
        reelGap: REEL_GAP,
      },
      creditCenter,
    );

    this.paylinePanel.showPreview(this.activeLines);
  }

  private buildPortraitControls(L: LayoutDims, reelsBottom: number): void {
    const availBelow = L.h - reelsBottom;
    const stepperW = Math.min(140, L.w * 0.36);
    const stepperH = 44;

    // Two steppers side-by-side under reels (BET left, LINES right).
    const sideMargin = Math.max(38, L.w * 0.13);
    const stepperY = reelsBottom + Math.min(40, availBelow * 0.12);
    const betX = sideMargin + stepperW / 2 - 18;
    const linesX = L.w - sideMargin - stepperW / 2 + 18;

    const betStepper = new Stepper(this, betX, stepperY, {
      label: 'BET',
      values: BET_OPTIONS,
      initial: this.betPerLine,
      width: stepperW,
      height: stepperH,
      onChange: (v) => this.setBet(v),
    });
    betStepper.setDepth(150);

    const linesStepper = new Stepper(this, linesX, stepperY, {
      label: 'LINES',
      values: LINE_OPTIONS,
      initial: this.activeLines,
      width: stepperW,
      height: stepperH,
      onChange: (v) => this.setLines(v),
    });
    linesStepper.setDepth(150);

    // SPIN bottom-center, big.
    const spinY = L.h - L.spinRadius - Math.max(16, L.h * 0.025);
    this.spinButton = new SpinButton(this, L.w / 2, spinY, () => this.handleSpin(), L.spinRadius);
    this.spinButton.setDepth(150);

    // AUTO and PAYTABLE flanking SPIN.
    const auxOffset = L.spinRadius + Math.max(48, L.w * 0.16);
    this.autoSpin = new AutoSpinController(this, L.w / 2 - auxOffset, spinY, {
      spin: () => this.handleSpin(),
      isSpinning: () => this.spinning,
      canSpin: () => this.balance >= this.betPerLine * this.activeLines,
    });
    new PaytableModal(this, L.w / 2 + auxOffset, spinY);
  }

  private buildLandscapeControls(L: LayoutDims, reelsBottom: number): void {
    // All controls live in a single bottom row centered on SPIN.
    const spinY = Math.max(L.h - L.spinRadius - 16, reelsBottom + L.spinRadius + 14);
    this.spinButton = new SpinButton(this, L.w / 2, spinY, () => this.handleSpin(), L.spinRadius);
    this.spinButton.setDepth(150);

    const stepperW = Math.min(140, Math.max(110, L.w * 0.16));
    const stepperH = Math.min(50, Math.max(42, L.spinRadius * 0.7));
    // Side stepper x — leave a 24px gap to SPIN's outer edge + side-button radius (~18).
    const stepperOffset = L.spinRadius + 28 + stepperW / 2 + 18;
    const auxOffset = stepperOffset + stepperW / 2 + Math.max(56, L.w * 0.06);

    const betStepper = new Stepper(this, L.w / 2 - stepperOffset, spinY, {
      label: 'BET',
      values: BET_OPTIONS,
      initial: this.betPerLine,
      width: stepperW,
      height: stepperH,
      onChange: (v) => this.setBet(v),
    });
    betStepper.setDepth(150);

    const linesStepper = new Stepper(this, L.w / 2 + stepperOffset, spinY, {
      label: 'LINES',
      values: LINE_OPTIONS,
      initial: this.activeLines,
      width: stepperW,
      height: stepperH,
      onChange: (v) => this.setLines(v),
    });
    linesStepper.setDepth(150);

    this.autoSpin = new AutoSpinController(this, L.w / 2 - auxOffset, spinY, {
      spin: () => this.handleSpin(),
      isSpinning: () => this.spinning,
      canSpin: () => this.balance >= this.betPerLine * this.activeLines,
    });
    new PaytableModal(this, L.w / 2 + auxOffset, spinY);
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

    Balance.deduct(totalBet);
    this.balance = Balance.getBalance();
    this.hud.countTo('CREDIT', this.balance, 400);

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
    const result: string[][] = this.reels.map((r) => r.getVisibleSymbols());
    const wins: WinLine[] = evaluate(result, [...PAYLINES], this.activeLines, this.betPerLine);
    const winSum = totalWin(wins);

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

    this.paylinePanel.showPreview(this.activeLines);
  }

  private indicateInsufficient(): void {
    audio.play('error');
    this.hud.flashError('CREDIT');
    const t = this.add
      .text(this.scale.width / 2, this.blockY + this.blockH + 30, 'INSUFFICIENT CREDITS', {
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
      .text(this.scale.width / 2, this.blockY + this.blockH / 2 - 80, `BIG WIN  +${amount}`, {
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
    this.tweens.add({ targets: label, scale: 1, duration: 280, ease: 'Back.Out' });
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
      const burst = this.add.particles(this.scale.width / 2, this.blockY + this.blockH / 2, SPARKLE_TEXTURE, {
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
    const reelX = this.blockX + reelIndex * (this.symbolSize + REEL_GAP);
    const reelCenterX = reelX + this.symbolSize / 2;
    const reelCenterY = this.blockY + this.blockH / 2;

    const flash = this.add.graphics();
    flash.setDepth(130);
    flash.fillStyle(0xffffff, 0.5);
    flash.fillRoundedRect(reelX, this.blockY, this.symbolSize, this.blockH, 8);
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
