// Extend the Window interface to include the game property
interface Window {
    game: Phaser.Game | null;
}

declare namespace Phaser {
    interface MainScene {
      grid: Phaser.GameObjects.Rectangle[][];
      fogLayer: Phaser.GameObjects.Rectangle[][];
      // Declare other properties here if needed
    }
  }
  