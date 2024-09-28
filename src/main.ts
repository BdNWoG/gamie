import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';

// Extend the global Window interface to include the 'game' property
declare global {
  interface Window {
    game: Phaser.Game;
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  scene: MainScene,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};

window.onload = () => {
  // Create the Phaser game instance and assign it to window.game
  window.game = new Phaser.Game(config);
};
