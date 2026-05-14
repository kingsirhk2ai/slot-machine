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
import { createTitle, TITLE_BAR_PAD_V } from '../ui/Title';
import { PaylinePanel } from '../ui/PaylinePanel';
import { Stepper } from '../ui/Stepper';
import { PaytableModal } from '../ui/PaytableModal';
import { AutoSpinController } from '../ui/AutoSpinController';
import { evaluate, totalWin, countScatters, freeSpinsAwarded, type WinLine } from '../systems/PaylineEvaluator';
import { Balance } from '../systems/Balance';
import { WinFx } from '../ui/WinFx';
import { audio } from '../systems/AudioManager';
import { settings, sessionStats } from '../systems/Settings';
import { SettingsModal } from '../ui/SettingsModal';
import { SpinHistory, type SpinTier } from '../ui/SpinHistory';
import { BuyBonusModal } from '../ui/BuyBonusModal';

const NUM_REELS = 5;
const VISIBLE_ROWS = 3;
const REEL_GAP = 4;

const DEFAULT_BET = 1;
const DEFAULT_LINES = 20;

interface LayoutDims {
  w: number;
  h: number;
  portrait: boolean;
  symbolSize: number;
  cellH: number;
  blockX: number;
  blockY: number;
  blockW: number;
  blockH: number;
  spinRadius: number;
  titleSize: number;
  titleBarH: number;
  titleBarW: number;
  titleCenterY: number;
  hudPanelW: number;
  hudPanelH: number;
  hudPanelGap: number;
  hudCenterX: number;
  hudCenterY: number;
  stepperW: number;
  stepperH: number;
  stepperY: number;
  spinY: number;
  // Landscape-only: unified bottom control deck.
  deckTop: number;
  deckH: number;
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
  private spinHistory?: SpinHistory;

  private betPerLine = DEFAULT_BET;
  private activeLines = DEFAULT_LINES;
  private balance = 0;
  private lastWin = 0;

  // Free spin state.
  private freeSpinsRemaining = 0;
  private freeSpinsTotal = 0;
  private freeSpinsWinSoFar = 0;
  private readonly FREE_SPIN_MULTIPLIER = 2;
  private freeSpinBadge?: Phaser.GameObjects.Container;
  private freeSpinBadgeText?: Phaser.GameObjects.Text;
  private freeSpinTimer?: Phaser.Time.TimerEvent;

  // Mystery multiplier — set per spin, reset after evaluation. Stacks with
  // free-spin multiplier when both apply.
  private mysteryMultiplier = 1;
  private buyBonus?: BuyBonusModal;

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
      this.freeSpinTimer?.remove();
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
    const hudPanelCount = 3;

    if (portrait) {
      // Tight chrome — reels dominate. Title becomes a slim header strip.
      const titleSize = Math.max(16, Math.min(22, Math.floor(w / 18)));
      const titleBarH = titleSize + TITLE_BAR_PAD_V * 2;
      const titleBarW = Math.min(w - 16, titleSize * 17);
      const titleTop = 4;
      const titleCenterY = titleTop + titleBarH / 2;

      // HUD — slim 3-panel bar.
      const hudPanelGap = 5;
      const hudPanelW = Math.min(120, (w - 10 - hudPanelGap * (hudPanelCount - 1)) / hudPanelCount);
      const hudPanelH = Math.max(34, Math.min(40, hudPanelW * 0.32));
      const hudTop = titleTop + titleBarH + 4;
      const hudCenterY = hudTop + hudPanelH / 2;
      const hudBottom = hudTop + hudPanelH;

      // Bottom band — minimal SPIN + stepper.
      const spinRadius = Math.max(36, Math.min(46, w * 0.115));
      const stepperH = 34;
      const stepperW = Math.min(135, (w - 40) / 2);
      const bottomMargin = 10;
      const stepperToSpinGap = 6;
      const spinY = h - bottomMargin - spinRadius;
      const stepperY = spinY - spinRadius - stepperToSpinGap - stepperH / 2;
      const stepperTop = stepperY - stepperH / 2;

      // Reel area — fills everything between HUD and stepper.
      const reelTop = hudBottom + 4;
      const reelBottom = stepperTop - 4;
      const reelArea = Math.max(180, reelBottom - reelTop);

      const symbolSize = Math.floor(Math.min(
        160,
        Math.max(48, (w - 4 - (NUM_REELS - 1) * REEL_GAP) / NUM_REELS),
      ));
      const cellH = Math.floor(reelArea / VISIBLE_ROWS);

      const blockW = NUM_REELS * symbolSize + (NUM_REELS - 1) * REEL_GAP;
      const blockH = VISIBLE_ROWS * cellH;
      const blockX = Math.floor((w - blockW) / 2);
      const blockY = Math.floor(reelTop);

      return {
        w, h, portrait: true, symbolSize, cellH,
        blockX, blockY, blockW, blockH,
        spinRadius,
        titleSize, titleBarH, titleBarW, titleCenterY,
        hudPanelW, hudPanelH, hudPanelGap, hudCenterX: w / 2, hudCenterY,
        stepperW, stepperH, stepperY,
        spinY,
        deckTop: 0, deckH: 0,
      };
    }

    // Landscape — Vegas cabinet layout (Lightning Link / Cash Frenzy):
    //   • slim branding strip on top (logo only)
    //   • reels dominate the middle, full-width
    //   • UNIFIED bottom control deck — slim, with large controls filling it
    const titleSize = Math.max(18, Math.min(24, h * 0.062));
    const titleBarH = titleSize + TITLE_BAR_PAD_V * 2;
    const titleBarW = Math.min(w * 0.62, titleSize * 18);
    const titleTop = 4;
    const titleCenterY = titleTop + titleBarH / 2;
    const titleBottom = titleTop + titleBarH;

    // Bottom deck — minimal footprint. The deck is just an ornamental gold
    // wire + soft wash; tap targets stay sized for thumbs, not the deck.
    const deckH = Math.max(34, Math.min(42, h * 0.11));
    const deckTop = h - deckH - 3;
    const deckCenterY = deckTop + deckH / 2;

    // SPIN intentionally pokes well above the deck for emphasis.
    const spinRadius = Math.max(26, Math.min(32, h * 0.082));
    const spinY = deckCenterY;

    const stepperH = Math.max(24, Math.min(28, deckH * 0.66));
    const stepperW = Math.max(96, Math.min(128, w * 0.15));
    // Stepper sits a hair below center so its top-tab label has room above.
    const stepperY = spinY + 2;

    // HUD readouts inset into deck (left side, horizontal trio).
    const hudPanelGap = 4;
    const hudPanelH = Math.max(34, Math.min(40, deckH * 0.94));
    const hudPanelW = Math.max(70, Math.min(94, w * 0.112));
    const hudCenterY = deckCenterY;
    const sidePad = 12;
    const hudTrioW = hudPanelCount * hudPanelW + (hudPanelCount - 1) * hudPanelGap;
    const hudCenterX = sidePad + hudTrioW / 2;

    // Reel area — clearance below title accounts for cabinet corner diamonds
    // (CabinetFrame extends ~19px above blockY).
    const cabinetTopOverhang = 22;
    const reelTop = titleBottom + Math.max(2, cabinetTopOverhang - TITLE_BAR_PAD_V);
    const reelBottom = deckTop - 4;
    const reelAreaH = Math.max(140, reelBottom - reelTop);
    const reelAreaW = w - 16;

    // Square cells — fixed 1:1 ratio so symbols never look stretched. Pick
    // the largest square that fits in both reel-area dimensions.
    const cellByWidth = (reelAreaW - (NUM_REELS - 1) * REEL_GAP) / NUM_REELS;
    const cellByHeight = reelAreaH / VISIBLE_ROWS;
    const cellSize = Math.floor(Math.max(72, Math.min(cellByWidth, cellByHeight, 160)));
    const symbolSize = cellSize;
    const cellH = cellSize;
    const blockW = NUM_REELS * symbolSize + (NUM_REELS - 1) * REEL_GAP;
    const blockH = VISIBLE_ROWS * cellH;
    const blockX = Math.floor((w - blockW) / 2);
    const blockY = Math.floor(reelTop + (reelAreaH - blockH) / 2);

    return {
      w, h, portrait: false, symbolSize, cellH,
      blockX, blockY, blockW, blockH,
      spinRadius,
      titleSize, titleBarH, titleBarW, titleCenterY,
      hudPanelW, hudPanelH, hudPanelGap, hudCenterX, hudCenterY,
      stepperW, stepperH, stepperY,
      spinY,
      deckTop, deckH,
    };
  }

  private buildLayout(): void {
    const L = this.computeLayout();
    this.blockX = L.blockX;
    this.blockY = L.blockY;
    this.blockW = L.blockW;
    this.blockH = L.blockH;
    this.symbolSize = L.symbolSize;

    new Background(this, L.w, L.h);

    // Title / branding strip on top in both orientations.
    if (L.titleSize > 0) {
      createTitle(this, L.w / 2, L.titleCenterY, L.titleSize, { width: L.titleBarW });
    }

    // Landscape: draw the unified bottom control deck before placing HUD/buttons.
    if (!L.portrait) {
      this.drawBottomDeck(L);
    }

    // HUD readouts — portrait: top strip centered. Landscape: inset into
    // bottom deck, anchored on the left.
    const hudCfg = L.portrait
      ? {}
      : {
          labelFontPx: Math.max(10, Math.min(13, Math.round(L.hudPanelH * 0.19))),
          valueFontPx: Math.max(18, Math.min(28, Math.round(L.hudPanelH * 0.42))),
          style: 'led' as const,
        };
    this.hud = new Hud(this, {
      centerX: L.hudCenterX,
      topY: L.hudCenterY - L.hudPanelH / 2,
      panelW: L.hudPanelW,
      panelH: L.hudPanelH,
      gap: L.hudPanelGap,
      panels: ['CREDIT', 'TOTAL BET', 'WIN'],
      ...hudCfg,
    });

    // Cabinet + reels.
    this.cabinet = new CabinetFrame(this, L.blockX, L.blockY, L.blockW, L.blockH);

    for (let i = 0; i < NUM_REELS; i++) {
      const strip = new ReelStrip(REEL_STRIPS[i]);
      const rx = L.blockX + i * (L.symbolSize + REEL_GAP) + L.symbolSize / 2;
      const reel = new ReelView(this, rx, L.blockY, strip, L.symbolSize, rng, L.cellH);
      reel.setDepth(110);
      this.reels.push(reel);
    }

    for (let i = 1; i < NUM_REELS; i++) {
      const sx = L.blockX + i * L.symbolSize + (i - 1) * REEL_GAP + REEL_GAP / 2;
      drawReelSeparator(this, sx, L.blockY + 4, L.blockY + L.blockH - 4);
    }

    this.paylinePanel = new PaylinePanel(
      this,
      { blockX: L.blockX, blockY: L.blockY, symbolSize: L.symbolSize, cellHeight: L.cellH, reelGap: REEL_GAP, numReels: NUM_REELS },
      [...PAYLINES],
    );

    // Controls area beneath reels.
    if (L.portrait) {
      this.buildPortraitControls(L);
    } else {
      this.buildLandscapeControls(L);
    }

    this.refreshHud(true);

    // Settings (gear) — top-right corner. Houses mute, volume sliders, quick-spin.
    const settingsOffset = L.portrait ? 28 : 32;
    new SettingsModal(this, L.w - settingsOffset, settingsOffset);

    // Spin history — top-LEFT pill mirroring the gear placement.
    this.spinHistory = new SpinHistory(this, settingsOffset + 50, settingsOffset);

    // Buy Bonus — top, left of the gear, mirrors the layout language.
    const buyBonusX = L.w - settingsOffset - 32 - 60;
    this.buyBonus = new BuyBonusModal(this, buyBonusX, settingsOffset, {
      getTotalBet: () => this.betPerLine * this.activeLines,
      getBalance: () => this.balance,
      isBusy: () => this.spinning || this.freeSpinsRemaining > 0 || this.autoSpin.isAutoActive(),
      onConfirm: (cost, freeSpins) => this.purchaseFreeSpins(cost, freeSpins),
    });
    this.refreshBuyBonusEnabled();

    const creditCenter = this.hud.panelCenter('CREDIT') ?? { x: L.w / 2, y: L.h - 60 };
    this.winFx = new WinFx(
      this,
      {
        blockX: L.blockX,
        blockY: L.blockY,
        blockW: L.blockW,
        blockH: L.blockH,
        symbolSize: L.symbolSize,
        cellHeight: L.cellH,
        reelGap: REEL_GAP,
      },
      creditCenter,
    );

    this.paylinePanel.showPreview(this.activeLines);
  }

  private buildPortraitControls(L: LayoutDims): void {
    const betX = L.w / 2 - L.stepperW / 2 - 26;
    const linesX = L.w / 2 + L.stepperW / 2 + 26;

    const betStepper = new Stepper(this, betX, L.stepperY, {
      label: 'BET',
      values: BET_OPTIONS,
      initial: this.betPerLine,
      width: L.stepperW,
      height: L.stepperH,
      withMaxButton: true,
      onChange: (v) => this.setBet(v),
    });
    betStepper.setDepth(150);

    const linesStepper = new Stepper(this, linesX, L.stepperY, {
      label: 'LINES',
      values: LINE_OPTIONS,
      initial: this.activeLines,
      width: L.stepperW,
      height: L.stepperH,
      onChange: (v) => this.setLines(v),
    });
    linesStepper.setDepth(150);

    // SPIN bottom-center, big.
    this.spinButton = new SpinButton(this, L.w / 2, L.spinY, () => this.handleSpin(), L.spinRadius);
    this.spinButton.setDepth(150);

    // AUTO and PAYTABLE flanking SPIN.
    const auxOffset = L.spinRadius + Math.max(46, L.w * 0.14);
    this.autoSpin = new AutoSpinController(this, L.w / 2 - auxOffset, L.spinY, {
      spin: () => this.handleSpin(),
      isSpinning: () => this.spinning,
      canSpin: () => this.balance >= this.betPerLine * this.activeLines,
    });
    new PaytableModal(this, L.w / 2 + auxOffset, L.spinY);
  }

  private drawBottomDeck(L: LayoutDims): void {
    // Lightweight footer: a 3D-bevel gold wire across the top edge, ruby
    // diamond endcaps that echo the title-bar ornaments, and a gentle dark
    // wash that fades into the background. Controls carry their own bezels.
    const x = 4;
    const y = L.deckTop;
    const w = L.w - 8;
    const h = L.deckH;

    // Soft dark wash — fades top→bottom so the deck dissolves into the bg.
    const wash = this.add.graphics();
    wash.setDepth(99);
    wash.fillGradientStyle(0x0a0a18, 0x0a0a18, 0x0a0a18, 0x0a0a18, 0, 0, 0.32, 0.10);
    wash.fillRect(x, y + 3, w, h - 3);

    // 3-line bevel rope — bright highlight, mid gold, deep shadow.
    const ropeStart = x + 16;
    const ropeEnd = x + w - 16;
    const rope = this.add.graphics();
    rope.setDepth(101);
    rope.lineStyle(1, 0xfff4b3, 0.95);
    rope.lineBetween(ropeStart, y, ropeEnd, y);
    rope.lineStyle(1, 0xffd700, 1);
    rope.lineBetween(ropeStart, y + 1, ropeEnd, y + 1);
    rope.lineStyle(1, 0x6a4a08, 0.85);
    rope.lineBetween(ropeStart, y + 2, ropeEnd, y + 2);

    // Soft gold inner glow just below the rope (additive).
    const glow = this.add.graphics();
    glow.setDepth(100);
    glow.fillStyle(0xffd700, 0.18);
    glow.fillRect(ropeStart, y + 3, ropeEnd - ropeStart, 1);
    glow.fillStyle(0xffd700, 0.10);
    glow.fillRect(ropeStart, y + 4, ropeEnd - ropeStart, 1);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    // Ruby-diamond endcaps tying back to the title-bar style.
    const drawEndcap = (cx: number) => {
      const cap = this.add.graphics();
      cap.setDepth(102);
      const sx = 5, sy = 6;
      cap.fillStyle(0xff3355, 1);
      cap.beginPath();
      cap.moveTo(cx, y + 1 - sy);
      cap.lineTo(cx + sx, y + 1);
      cap.lineTo(cx, y + 1 + sy);
      cap.lineTo(cx - sx, y + 1);
      cap.closePath();
      cap.fillPath();
      cap.lineStyle(1.2, 0xffd700, 1);
      cap.strokePath();
      cap.fillStyle(0xffffff, 0.55);
      cap.beginPath();
      cap.moveTo(cx, y + 1 - sy + 1.5);
      cap.lineTo(cx + sx * 0.45, y + 1 - sy * 0.15);
      cap.lineTo(cx - sx * 0.15, y + 1 - sy * 0.4);
      cap.closePath();
      cap.fillPath();
    };
    drawEndcap(x + 10);
    drawEndcap(x + w - 10);
  }

  private buildLandscapeControls(L: LayoutDims): void {
    // Right-anchored: PAYTABLE (corner) → SPIN (big) → AUTO.
    // Left-anchored: HUD trio (already placed) → BET → LINES.
    const sideMargin = 12;
    const paytableR = 22;
    const paytableX = L.w - sideMargin - paytableR;
    const spinX = paytableX - paytableR - 14 - L.spinRadius;
    const autoX = spinX - L.spinRadius - 38;

    // BET/LINES live in the middle of the deck, between HUD trio and AUTO.
    const hudRightEdge = L.hudCenterX + (3 * L.hudPanelW + 2 * L.hudPanelGap) / 2;
    const stepperZoneStart = hudRightEdge + 16; // breathing space after divider
    const stepperZoneEnd = autoX - L.spinRadius / 2 - 18;
    const stepperGap = 24;
    const stepperZoneW = stepperZoneEnd - stepperZoneStart;
    const stepperPair = L.stepperW * 2 + stepperGap;
    const stepperPairStart = stepperZoneStart + (stepperZoneW - stepperPair) / 2;
    const betX = stepperPairStart + L.stepperW / 2;
    const linesX = betX + L.stepperW + stepperGap;

    const betStepper = new Stepper(this, betX, L.stepperY, {
      label: 'BET',
      values: BET_OPTIONS,
      initial: this.betPerLine,
      width: L.stepperW,
      height: L.stepperH,
      withMaxButton: true,
      onChange: (v) => this.setBet(v),
    });
    betStepper.setDepth(150);

    const linesStepper = new Stepper(this, linesX, L.stepperY, {
      label: 'LINES',
      values: LINE_OPTIONS,
      initial: this.activeLines,
      width: L.stepperW,
      height: L.stepperH,
      onChange: (v) => this.setLines(v),
    });
    linesStepper.setDepth(150);

    this.autoSpin = new AutoSpinController(this, autoX, L.spinY, {
      spin: () => this.handleSpin(),
      isSpinning: () => this.spinning,
      canSpin: () => this.balance >= this.betPerLine * this.activeLines,
    });

    this.spinButton = new SpinButton(this, spinX, L.spinY, () => this.handleSpin(), L.spinRadius);
    this.spinButton.setDepth(150);

    new PaytableModal(this, paytableX, L.spinY);
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
    if (this.spinning) {
      this.quickStopAllReels();
      return;
    }
    const totalBet = this.betPerLine * this.activeLines;
    const isFreeSpin = this.freeSpinsRemaining > 0;
    if (!isFreeSpin && this.balance < totalBet) {
      this.indicateInsufficient();
      return;
    }

    this.spinning = true;
    this.spinButton.setSpinningMode(true);
    this.paylinePanel.clearWins();

    audio.play('spin-start');
    audio.play('reel-loop', { loop: true, volume: 0.7 });

    if (!isFreeSpin) {
      Balance.deduct(totalBet);
      this.balance = Balance.getBalance();
      this.hud.countTo('CREDIT', this.balance, 400);
      // Mystery multiplier rolls only on PAID spins. Reveal banner before reels stop.
      this.mysteryMultiplier = this.rollMystery();
      if (this.mysteryMultiplier > 1) {
        this.showMysteryBanner(this.mysteryMultiplier);
      }
    }

    this.refreshBuyBonusEnabled();

    this.lastWin = 0;
    this.hud.setValue('WIN', 0);

    const quick = settings.isQuickSpin();
    const baseDur = quick ? 420 : 1200;
    const stagger = quick ? 80 : 250;
    let finished = 0;
    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      const stop = reel.strip.pickStopIndex(rng);
      const duration = baseDur + i * stagger;
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

  private quickStopAllReels(): void {
    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      if (!reel.isSpinning()) continue;
      this.time.delayedCall(i * 60, () => reel.snapToStop());
    }
  }

  private onAllReelsStopped(): void {
    const result: string[][] = this.reels.map((r) => r.getVisibleSymbols());
    const rawWins: WinLine[] = evaluate(result, [...PAYLINES], this.activeLines, this.betPerLine);
    const isFreeSpin = this.freeSpinsRemaining > 0;
    const multiplier = (isFreeSpin ? this.FREE_SPIN_MULTIPLIER : 1) * this.mysteryMultiplier;
    const wins: WinLine[] =
      multiplier === 1
        ? rawWins
        : rawWins.map((w) => ({ ...w, payout: w.payout * multiplier }));
    const winSum = totalWin(wins);

    const totalBet = this.betPerLine * this.activeLines;
    let tier: SpinTier = 'none';
    if (wins.length > 0) {
      this.paylinePanel.showWins(wins, (w) => this.winFx.floatLineAmount(w));
      Balance.add(winSum);
      this.balance = Balance.getBalance();
      this.lastWin = winSum;
      if (isFreeSpin) this.freeSpinsWinSoFar += winSum;

      const isMega = winSum >= totalBet * 25;
      const isBig = !isMega && winSum >= totalBet * 10;
      const isMedium = !isBig && !isMega && (winSum >= totalBet * 3 || wins.length >= 3);
      tier = isMega ? 'mega' : isBig ? 'big' : isMedium ? 'medium' : 'small';
      const countDuration = isMega ? 1800 : isBig ? 1400 : 1000;
      this.hud.countTo('WIN', winSum, countDuration);
      this.hud.countTo('CREDIT', this.balance, countDuration);
      this.hud.pulseValue('WIN');
      this.hud.pulsePanel('CREDIT');
      this.hud.pulsePanel('WIN');

      if (isMega || isBig) audio.play('win-big');
      else if (isMedium) audio.play('win-medium');
      else audio.play('win-small');

      this.winFx.centerBadge(winSum);
      this.winFx.coinBurst(isMega ? 56 : isBig ? 40 : 28);

      if (isBig || isMega) {
        this.playBigWin(winSum);
        this.winFx.confettiShower();
      }
      if (isMega) {
        this.winFx.playMegaWin(winSum);
      }

      window.dispatchEvent(
        new CustomEvent('slot:win', { detail: { amount: winSum, lines: wins.length, isBig: isBig || isMega } }),
      );
    }

    this.spinHistory?.record(tier);

    // Session stats — only count paid spins towards wagered, but credit
    // every win (paid + free-spin wins) towards "won this session".
    sessionStats.record(isFreeSpin ? 0 : totalBet, winSum);

    // Mystery is one-shot per spin — clear before next.
    this.mysteryMultiplier = 1;

    // Scatter / free-spin trigger.
    const scatters = countScatters(result);
    const awarded = freeSpinsAwarded(scatters);

    this.spinning = false;
    this.spinButton.setSpinningMode(false);

    if (awarded > 0) {
      this.triggerFreeSpins(scatters, awarded);
    } else if (isFreeSpin) {
      this.advanceFreeSpins();
    } else {
      this.autoSpin.onSpinComplete();
    }

    this.refreshBuyBonusEnabled();
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

  // ---------- free spins ----------

  private triggerFreeSpins(scatters: number, awarded: number): void {
    const wasFreeSpin = this.freeSpinsRemaining > 0;
    this.freeSpinsRemaining += awarded;
    this.freeSpinsTotal += awarded;
    if (!wasFreeSpin) {
      this.freeSpinsWinSoFar = 0;
      sessionStats.recordFreeSpinsTrigger();
    }
    this.autoSpin.stop();
    audio.play('win-big');
    this.showFreeSpinBadge();
    this.updateFreeSpinBadge();
    this.refreshBuyBonusEnabled();
    this.winFx.playFreeSpinsTrigger(scatters, awarded, () => {
      this.freeSpinTimer = this.time.delayedCall(450, () => this.runFreeSpinLoop());
    });
  }

  /** Player-purchased free spins. Skip the scatter trigger animation. */
  private purchaseFreeSpins(cost: number, awarded: number): void {
    if (this.spinning || this.freeSpinsRemaining > 0) return;
    if (this.balance < cost) {
      this.indicateInsufficient();
      return;
    }
    Balance.deduct(cost);
    this.balance = Balance.getBalance();
    this.hud.countTo('CREDIT', this.balance, 400);
    this.freeSpinsRemaining = awarded;
    this.freeSpinsTotal = awarded;
    this.freeSpinsWinSoFar = 0;
    sessionStats.recordFreeSpinsTrigger();
    this.autoSpin.stop();
    this.showFreeSpinBadge();
    this.updateFreeSpinBadge();
    this.refreshBuyBonusEnabled();
    // Brief celebratory banner, then drop straight into spinning.
    audio.play('win-big');
    this.flashBuyBonusBanner(awarded);
    this.freeSpinTimer = this.time.delayedCall(900, () => this.runFreeSpinLoop());
  }

  private flashBuyBonusBanner(awarded: number): void {
    const W = this.scale.width;
    const y = this.blockY + 30;
    const bannerW = 280;
    const bannerH = 56;
    const c = this.add.container(W / 2, y);
    c.setDepth(260);
    const g = this.add.graphics();
    g.fillStyle(0x002233, 0.95);
    g.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 14);
    g.lineStyle(2.5, 0x44eaff, 1);
    g.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 14);
    c.add(g);
    const t = this.add
      .text(0, 0, `BONUS PURCHASED\n${awarded} FREE SPINS`, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#44eaff',
        align: 'center',
      })
      .setOrigin(0.5);
    t.setShadow(0, 0, '#44eaff', 10, false, true);
    c.add(t);
    c.setAlpha(0);
    c.setScale(0.6);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 240, ease: 'Back.Out' });
    this.tweens.add({
      targets: c,
      alpha: 0,
      y: y - 30,
      duration: 360,
      delay: 1100,
      ease: 'Sine.In',
      onComplete: () => c.destroy(),
    });
  }

  // ---------- mystery multiplier ----------

  /** ~1.5% per paid spin, weighted 60% / 30% / 10% across 2× / 3× / 5×. */
  private rollMystery(): number {
    if (rng.rollInt(1, 1000) > 15) return 1;
    const r = rng.rollInt(1, 100);
    if (r <= 60) return 2;
    if (r <= 90) return 3;
    return 5;
  }

  private showMysteryBanner(mult: number): void {
    const W = this.scale.width;
    const y = this.blockY + 36;
    const bannerW = 240;
    const bannerH = 50;
    const c = this.add.container(W / 2, y);
    c.setDepth(260);
    const tint = mult >= 5 ? 0xff3355 : mult >= 3 ? 0xff8a3a : 0xffd700;
    const g = this.add.graphics();
    g.fillStyle(0x140014, 0.92);
    g.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 12);
    g.lineStyle(2.5, tint, 1);
    g.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 12);
    c.add(g);
    const t = this.add
      .text(0, 0, `MYSTERY  ×${mult}`, {
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: `#${tint.toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0.5);
    t.setShadow(0, 0, `#${tint.toString(16).padStart(6, '0')}`, 14, false, true);
    c.add(t);
    c.setAlpha(0);
    c.setScale(0.4);
    this.tweens.add({ targets: c, alpha: 1, scale: 1.05, duration: 260, ease: 'Back.Out' });
    this.tweens.add({
      targets: c,
      scale: 1,
      duration: 200,
      delay: 260,
      ease: 'Sine.Out',
    });
    this.tweens.add({
      targets: c,
      alpha: 0,
      y: y - 24,
      duration: 360,
      delay: 1500,
      ease: 'Sine.In',
      onComplete: () => c.destroy(),
    });
    audio.play('win-medium');
  }

  private refreshBuyBonusEnabled(): void {
    if (!this.buyBonus) return;
    const busy = this.spinning || this.freeSpinsRemaining > 0 || this.autoSpin?.isAutoActive();
    this.buyBonus.setEnabled(!busy);
  }

  private advanceFreeSpins(): void {
    this.freeSpinsRemaining -= 1;
    this.updateFreeSpinBadge();
    if (this.freeSpinsRemaining <= 0) {
      const total = this.freeSpinsWinSoFar;
      this.freeSpinsTotal = 0;
      this.freeSpinsWinSoFar = 0;
      this.hideFreeSpinBadge();
      this.winFx.playFreeSpinsEnd(total);
      return;
    }
    this.freeSpinTimer = this.time.delayedCall(900, () => this.runFreeSpinLoop());
  }

  private runFreeSpinLoop(): void {
    if (this.freeSpinsRemaining <= 0) return;
    if (this.spinning) {
      this.freeSpinTimer = this.time.delayedCall(200, () => this.runFreeSpinLoop());
      return;
    }
    this.handleSpin();
  }

  private showFreeSpinBadge(): void {
    if (this.freeSpinBadge) return;
    const x = this.scale.width / 2;
    const y = Math.max(this.blockY - 18, 28);
    const w = 220;
    const h = 38;
    const wrap = this.add.container(x, y);
    wrap.setDepth(180);
    const g = this.add.graphics();
    g.fillStyle(0x002233, 0.92);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.lineStyle(2, 0x44eaff, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.lineStyle(1, 0x44eaff, 0.4);
    g.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 10);
    wrap.add(g);
    const t = this.add
      .text(0, 0, '', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#44eaff',
      })
      .setOrigin(0.5);
    t.setShadow(0, 0, '#44eaff', 8, false, true);
    wrap.add(t);
    wrap.setAlpha(0);
    wrap.setScale(0.6);
    this.tweens.add({ targets: wrap, alpha: 1, scale: 1, duration: 240, ease: 'Back.Out' });
    this.tweens.add({
      targets: wrap,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.freeSpinBadge = wrap;
    this.freeSpinBadgeText = t;
  }

  private updateFreeSpinBadge(): void {
    if (!this.freeSpinBadgeText) return;
    const used = this.freeSpinsTotal - this.freeSpinsRemaining;
    this.freeSpinBadgeText.setText(
      `FREE SPIN  ${used}/${this.freeSpinsTotal}   ×${this.FREE_SPIN_MULTIPLIER}`,
    );
  }

  private hideFreeSpinBadge(): void {
    if (!this.freeSpinBadge) return;
    const wrap = this.freeSpinBadge;
    this.freeSpinBadge = undefined;
    this.freeSpinBadgeText = undefined;
    this.tweens.killTweensOf(wrap);
    this.tweens.add({
      targets: wrap,
      alpha: 0,
      scale: 0.6,
      duration: 240,
      ease: 'Sine.In',
      onComplete: () => wrap.destroy(),
    });
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
