import Phaser from 'phaser';

export function updateFogOfWar(
  scene: Phaser.Scene,
  characters: Phaser.GameObjects.Group,
  fogLayer: Phaser.GameObjects.Rectangle[][],
  fogRadius: number,
  gridSize: number,
  rows: number,
  cols: number
) {
  // Cast the children of the group to Sprite array
  (characters.getChildren() as Phaser.GameObjects.Sprite[]).forEach((character) => {
    const charX = Math.floor(character.x / gridSize);
    const charY = Math.floor(character.y / gridSize);
    updateFogForCharacter(scene, charX, charY, fogLayer, fogRadius, gridSize, rows, cols);
  });
}

function updateFogForCharacter(
  scene: Phaser.Scene,
  charX: number,
  charY: number,
  fogLayer: Phaser.GameObjects.Rectangle[][],
  fogRadius: number,
  gridSize: number,
  rows: number,
  cols: number
) {
  for (let row = Math.max(0, charY - fogRadius); row <= Math.min(rows - 1, charY + fogRadius); row++) {
    for (let col = Math.max(0, charX - fogRadius); col <= Math.min(cols - 1, charX + fogRadius); col++) {
      const distance = Math.abs(col - charX) + Math.abs(row - charY);
      if (distance <= fogRadius) {
        fogLayer[row][col].setVisible(false); // Reveal the tile within vision radius
      }
    }
  }
}
