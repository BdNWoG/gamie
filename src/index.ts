import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // Preload assets
    }

    create() {
        // Add game objects and logic
        this.add.text(100, 100, 'Hello Phaser!', { color: '#fff' });
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: MainScene,
    parent: 'game-container',
};

// Check if the game is already created to avoid duplicate instances
if (!window.game) {
    window.game = new Phaser.Game(config);
}
