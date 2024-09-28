import Phaser from 'phaser';
import { createStatsMenu } from '../ui/UI';

export function createCharacter(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Sprite {
  const character = scene.add.sprite(x, y, 'character').setScale(0.4);
  const characterHealthMenu = createStatsMenu(scene, 100, 50, 0, 1, x, y - 60);
  characterHealthMenu.setVisible(false);
  setupCharacterInteractions(scene, character, characterHealthMenu);
  return character;
}

function setupCharacterInteractions(scene: Phaser.Scene, character: Phaser.GameObjects.Sprite, characterHealthMenu: Phaser.GameObjects.Container) {
  character.setInteractive();

  character.on('pointerover', () => {
    characterHealthMenu.setVisible(true);
  });

  character.on('pointerout', () => {
    characterHealthMenu.setVisible(false);
  });

  character.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (pointer.leftButtonDown()) {
      scene.events.emit('showActionMenu', character);
    } else if (pointer.rightButtonDown()) {
      scene.events.emit('showAttributeMenu', character);
    }
  });
}
