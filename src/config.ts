import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainScene } from './scenes/MainScene';
import { PaytableScene } from './scenes/PaytableScene';

// Initial design size; the canvas is RESIZE-mode and fills the viewport at all times.
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
export const DESIGN_DPR = window.devicePixelRatio || 1;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: document.body,
  backgroundColor: 0x050410,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 3,
  },
  scene: [BootScene, PreloadScene, MainScene, PaytableScene],
};
