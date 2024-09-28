import Phaser from 'phaser';
import { createStatsMenu } from '../ui/UI';

export function spawnEnemies(scene: Phaser.Scene, gridSize: number, cols: number, rows: number) {
  const enemies = scene.add.group();

  for (let i = 0; i < 10; i++) {
    const randomX = Phaser.Math.Between(0, cols - 1);
    const randomY = Phaser.Math.Between(0, rows - 1);

    const enemySprite = scene.add.sprite(randomX * gridSize + gridSize / 2, randomY * gridSize + gridSize / 2, 'enemy');
    enemySprite.setScale(0.4);
    enemies.add(enemySprite);

    const enemyHealthMenu = createStatsMenu(scene, 100, 50, 0, 1, enemySprite.x, enemySprite.y - 60);
    enemyHealthMenu.setVisible(false);

    // Cast enemySprite to Sprite explicitly
    enemySprite.setInteractive();

    setupEnemyInteractions(scene, enemySprite, enemyHealthMenu);
  }

  return enemies;
}

function setupEnemyInteractions(scene: Phaser.Scene, enemy: Phaser.GameObjects.Sprite, enemyHealthMenu: Phaser.GameObjects.Container) {
  enemy.on('pointerover', () => {
    enemyHealthMenu.setVisible(true);
  });

  enemy.on('pointerout', () => {
    enemyHealthMenu.setVisible(false);
  });

  enemy.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (pointer.rightButtonDown()) {
      scene.events.emit('showAttributeMenu', enemy);
    }
  });
}
