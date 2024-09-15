import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
  private character: Phaser.GameObjects.Sprite | undefined;
  private gridSize: number = 64; // Size of each grid square (64x64)
  private rows: number = 50;    // Fixed number of rows (50)
  private cols: number = 50;    // Fixed number of columns (50)
  private grid: Phaser.GameObjects.Rectangle[][] = [];
  private isDragging: boolean = false;
  private dragStartPoint: { x: number; y: number } = { x: 0, y: 0 };
  private actionMenu: Phaser.GameObjects.Container | undefined; // Menu container
  private highlightedTiles: Phaser.GameObjects.Rectangle[] = []; // Highlighted tiles for movement
  private lastClickTime: number = 0; // Timestamp of the last click
  private doubleClickThreshold: number = 300; // Maximum time in ms between two clicks to be considered a double-click

  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    // Load the character sprite
    this.load.image('character', 'assets/character.png'); // Add your character image path
  }

  create() {
    // Set the world bounds to be 50x50 grid size (each tile is 64x64)
    this.cameras.main.setBounds(0, 0, this.cols * this.gridSize, this.rows * this.gridSize);
    this.physics.world.setBounds(0, 0, this.cols * this.gridSize, this.rows * this.gridSize);

    // Create the grid and place it statically on the screen
    this.createGrid();

    // Place the character at the center of the grid
    this.character = this.add.sprite(
      (this.cols / 2) * this.gridSize + this.gridSize / 2,
      (this.rows / 2) * this.gridSize + this.gridSize / 2,
      'character'
    );

    // Enable double-click detection on the character
    this.character.setInteractive({ useHandCursor: true });
    this.character.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleDoubleClick(pointer);
    });

    // Enable dragging for the entire camera
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startDrag(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.drag(pointer));
    this.input.on('pointerup', () => this.stopDrag());

    // Handle mouse wheel zooming
    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        gameObjects: Phaser.GameObjects.GameObject[],
        deltaX: number,
        deltaY: number,
        deltaZ: number
      ) => this.handleZoom(deltaY)
    );
  }

  createGrid() {
    // Create the grid of 50x50 tiles
    for (let row = 0; row < this.rows; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.cols; col++) {
        // Create grid square
        const tile = this.add.rectangle(
          col * this.gridSize + this.gridSize / 2,
          row * this.gridSize + this.gridSize / 2,
          this.gridSize,
          this.gridSize,
          0x000000
        ).setStrokeStyle(1, 0x00ff00);

        this.grid[row][col] = tile;
      }
    }
  }

  handleDoubleClick(pointer: Phaser.Input.Pointer) {
    const currentTime = pointer.downTime;
    const timeSinceLastClick = currentTime - this.lastClickTime;

    if (timeSinceLastClick <= this.doubleClickThreshold) {
      // It's a double-click
      this.showActionMenu();
    }

    this.lastClickTime = currentTime;
  }

  showActionMenu() {
    // If a menu already exists, remove it
    if (this.actionMenu) {
      this.actionMenu.destroy();
      this.actionMenu = undefined;
    }

    // Create a menu with options for "Move" and "Attack"
    const menuBackground = this.add.rectangle(0, 0, 120, 80, 0x333333).setOrigin(0);
    const moveText = this.add.text(10, 10, 'Move', { fontSize: '16px', color: '#fff' });
    const attackText = this.add.text(10, 40, 'Attack', { fontSize: '16px', color: '#fff' });

    // Create a container for the menu and position it at the character's location
    this.actionMenu = this.add.container(this.character?.x || 0, this.character?.y || 0, [
      menuBackground,
      moveText,
      attackText
    ]);

    // Make the menu options interactive (move)
    moveText.setInteractive();
    moveText.on('pointerdown', () => {
      this.highlightMovableTiles();
      this.actionMenu?.destroy(); // Remove menu after selecting an action
    });

    // Attack is not implemented yet, but let's just log it for now
    attackText.setInteractive();
    attackText.on('pointerdown', () => {
      console.log('Attack selected');
      this.actionMenu?.destroy(); // Remove menu after selecting an action
    });
  }

  highlightMovableTiles() {
    // Clear any previously highlighted tiles
    this.clearHighlightedTiles();

    // Get the character's current grid position
    const charX = Math.floor(this.character!.x / this.gridSize);
    const charY = Math.floor(this.character!.y / this.gridSize);

    // Highlight all tiles within a 2-block distance (Manhattan distance)
    for (let row = Math.max(0, charY - 2); row <= Math.min(this.rows - 1, charY + 2); row++) {
      for (let col = Math.max(0, charX - 2); col <= Math.min(this.cols - 1, charX + 2); col++) {
        const distance = Math.abs(col - charX) + Math.abs(row - charY);
        if (distance <= 2) {
          // Highlight the tile by changing its color
          const tile = this.grid[row][col];
          tile.setFillStyle(0x888888);
          this.highlightedTiles.push(tile);

          // Make the tile clickable to move the character there
          tile.setInteractive();
          tile.on('pointerdown', () => this.moveCharacter(col, row));
        }
      }
    }
  }

  clearHighlightedTiles() {
    // Reset all previously highlighted tiles to default color
    this.highlightedTiles.forEach((tile) => {
      tile.setFillStyle(0x000000);
      tile.removeInteractive(); // Disable clicking on them
    });
    this.highlightedTiles = [];
  }

  moveCharacter(targetCol: number, targetRow: number) {
    // Move the character to the selected tile
    this.character?.setPosition(
      targetCol * this.gridSize + this.gridSize / 2,
      targetRow * this.gridSize + this.gridSize / 2
    );

    // Clear the highlighted tiles
    this.clearHighlightedTiles();
  }

  startDrag(pointer: Phaser.Input.Pointer) {
    this.isDragging = true;
    this.dragStartPoint.x = pointer.x;
    this.dragStartPoint.y = pointer.y;
  }

  drag(pointer: Phaser.Input.Pointer) {
    if (this.isDragging) {
      // Calculate the camera movement based on the drag distance
      const dragDistanceX = this.dragStartPoint.x - pointer.x;
      const dragDistanceY = this.dragStartPoint.y - pointer.y;

      this.cameras.main.scrollX += dragDistanceX;
      this.cameras.main.scrollY += dragDistanceY;

      // Update the drag start point to the current pointer location
      this.dragStartPoint.x = pointer.x;
      this.dragStartPoint.y = pointer.y;
    }
  }

  stopDrag() {
    // Stop the dragging action
    this.isDragging = false;
  }

  handleZoom(deltaY: number) {
    // Zoom in or out based on the mouse wheel scroll
    const zoomFactor = this.cameras.main.zoom - deltaY * 0.001; // Adjust zoom sensitivity
    this.cameras.main.setZoom(Phaser.Math.Clamp(zoomFactor, 0.5, 2)); // Limit zoom levels
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  scene: MainScene,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE, // Make the game scale with the window
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
  window.game = new Phaser.Game(config);
};
