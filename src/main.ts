import Phaser from 'phaser';
import { gameConfig, DPR } from './config';
import { loadBalance } from './systems/Balance';
import { initNativeShell } from './systems/NativeShell';
import { i18n } from './systems/I18n';
import { loadAchievements } from './systems/Achievements';
import { loadDailyReward } from './systems/DailyReward';

// Text resolution override: rasterize text textures at dpr× their game-units size so
// the text textures themselves are crisp. Without this, fonts get bilinear-stretched
// when Phaser.Scale.FIT CSS-scales the canvas up on retina/HiDPI displays.
Phaser.GameObjects.GameObjectFactory.register(
  'text',
  function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ) {
    const enhanced: Phaser.Types.GameObjects.Text.TextStyle = {
      ...(style || {}),
      resolution: (style && (style as any).resolution) || DPR,
    };
    const obj = new Phaser.GameObjects.Text(this.scene, x, y, text, enhanced);
    this.scene.sys.displayList.add(obj);
    this.scene.sys.updateList.add(obj);
    return obj;
  },
);

async function boot(): Promise<void> {
  await Promise.all([loadBalance(), i18n.init(), loadAchievements(), loadDailyReward()]);
  initNativeShell();
  const game = new Phaser.Game(gameConfig);
  (window as any).__PHASER_GAME__ = game;
  (window as any).__DPR__ = DPR;
}

void boot();
