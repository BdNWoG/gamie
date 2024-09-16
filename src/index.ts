import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
  private character: Phaser.GameObjects.Sprite | undefined;
  private characterHealth: number = 100; // Health of the character
  private characterMana: number = 50;    // Mana of the character
  private characterExperience: number = 0; // Experience of the character
  private characterHealthMenu: Phaser.GameObjects.Container | undefined; // Health menu for the character
  private enemies: { sprite: Phaser.GameObjects.Sprite, health: number, mana: number, experience: number, x: number, y: number, healthMenu: Phaser.GameObjects.Container }[] = []; // Enemies with health, mana, and experience bars
  private gridSize: number = 64; // Size of each grid square (64x64)
  private rows: number = 40; // Fixed number of rows
  private cols: number = 40; // Fixed number of columns
  private grid: Phaser.GameObjects.Rectangle[][] = [];
  private isDragging: boolean = false;
  private dragStartPoint: { x: number; y: number } = { x: 0, y: 0 };
  private actionMenu: Phaser.GameObjects.Container | undefined; // Menu container
  private highlightedTiles: Phaser.GameObjects.Rectangle[] = []; // Highlighted tiles for movement or attack
  private lastClickTime: number = 0; // Timestamp of the last click
  private doubleClickThreshold: number = 300; // Maximum time in ms between two clicks to be considered a double-click

  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    // Load the character and enemy sprites
    this.load.image('character', 'assets/character.png'); // Add your character image path
    this.load.image('enemy', 'assets/enemy.png'); // Add your enemy image path
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

    this.character.setScale(0.4);

    // Create a health, mana, and experience menu for the character
    this.characterHealthMenu = this.createStatsMenu(this.characterHealth, this.characterMana, this.characterExperience, this.character!.x, this.character!.y - 60);
    this.characterHealthMenu.setVisible(false); // Initially hide the stats menu

    // Enable hover to show health, mana, and experience menu for character
    this.character.setInteractive();
    this.character.on('pointerover', () => {
      if (this.characterHealthMenu) {
        this.updateStatsMenu(this.characterHealthMenu, this.characterHealth, this.characterMana, this.characterExperience); // Update character health menu
        this.characterHealthMenu.setVisible(true); // Show stats menu on hover
      }
    });
    this.character.on('pointerout', () => {
      if (this.characterHealthMenu) {
        this.characterHealthMenu.setVisible(false); // Hide stats menu when hover ends
      }
    });

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

    // Randomly create 3 enemies on the map
    this.spawnEnemies();
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

    // Create a menu with options for "Move", "Attack", "Special", "Hold", and "Cancel"
    const menuWidth = 120;
    const menuHeight = 180; // Adjusted height to fit the new "Cancel" option
    const menuBackground = this.add.rectangle(0, 0, menuWidth, menuHeight, 0x333333).setOrigin(0); // Height increased
    const textStyle = { fontSize: '16px', color: '#fff' };

    const moveText = this.add.text(menuWidth / 2, 10, 'Move', textStyle).setOrigin(0.5);
    const attackText = this.add.text(menuWidth / 2, 40, 'Attack', textStyle).setOrigin(0.5);
    const specialText = this.add.text(menuWidth / 2, 70, 'Special', textStyle).setOrigin(0.5);
    const holdText = this.add.text(menuWidth / 2, 100, 'Hold', textStyle).setOrigin(0.5);
    const cancelText = this.add.text(menuWidth / 2, 130, 'Cancel', textStyle).setOrigin(0.5); // New "Cancel" option

    // Create a container for the menu and position it at the character's location
    this.actionMenu = this.add.container(this.character?.x || 0, this.character?.y || 0, [
      menuBackground,
      moveText,
      attackText,
      specialText,
      holdText,
      cancelText // Add "Cancel" to the container
    ]);

    // Make the "Move" option interactive
    moveText.setInteractive();
    moveText.on('pointerdown', () => {
        this.highlightMovableTiles();
        this.actionMenu?.destroy(); // Remove menu after selecting an action
    });

    // Make the "Attack" option interactive
    attackText.setInteractive();
    attackText.on('pointerdown', () => {
        this.highlightEnemyBlocks();
        this.actionMenu?.destroy(); // Remove menu after selecting an action
    });

    // Make the "Special" option interactive
    specialText.setInteractive();
    specialText.on('pointerdown', () => {
        this.handleSpecialAction();
        this.actionMenu?.destroy(); // Remove menu after selecting an action
    });

    // Make the "Hold" option interactive
    holdText.setInteractive();
    holdText.on('pointerdown', () => {
        this.handleHoldAction();
        this.actionMenu?.destroy(); // Remove menu after selecting an action
    });

    // Make the "Cancel" option interactive to simply close the menu
    cancelText.setInteractive();
    cancelText.on('pointerdown', () => {
        this.actionMenu?.destroy(); // Close the menu when "Cancel" is clicked
    });
  }

  // Placeholder for handling the Special action
  handleSpecialAction() {
    console.log("Special action triggered!");
    // Implement the special action logic here
  }

  // Placeholder for handling the Hold action
  handleHoldAction() {
    console.log("Hold action triggered!");
    // Implement the hold action logic here
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
    if (this.character) {
      this.character.setPosition(
        targetCol * this.gridSize + this.gridSize / 2,
        targetRow * this.gridSize + this.gridSize / 2
      );

      // Move the health menu along with the character
      if (this.characterHealthMenu) {
        this.characterHealthMenu.setPosition(this.character.x, this.character.y - 60);
      }

      // Clear the highlighted tiles
      this.clearHighlightedTiles();
    }
  }

  highlightEnemyBlocks() {
    // Clear any previously highlighted tiles
    this.clearHighlightedTiles();

    // Get the character's current grid position
    const charX = Math.floor(this.character!.x / this.gridSize);
    const charY = Math.floor(this.character!.y / this.gridSize);

    // Highlight blocks where enemies are within 1 block of the character
    this.enemies.forEach(({ sprite, x, y, healthMenu }) => {
      const distance = Math.abs(x - charX) + Math.abs(y - charY);

      if (distance === 1) {
        // Highlight the block where the enemy is by changing the tile's color
        const tile = this.grid[y][x];
        tile.setFillStyle(0xff0000); // Highlight with red color
        this.highlightedTiles.push(tile);

        // Make the tile clickable to attack the enemy
        tile.setInteractive();
        tile.once('pointerdown', () => {
          this.killEnemy(sprite, tile, healthMenu);
        });
      }
    });
  }

  killEnemy(enemy: Phaser.GameObjects.Sprite, tile: Phaser.GameObjects.Rectangle, healthMenu: Phaser.GameObjects.Container) {
    // Remove the enemy sprite and health menu from the scene
    enemy.destroy();
    healthMenu.destroy();

    // Remove the tile's highlight and interaction
    tile.setFillStyle(0x000000);
    tile.removeInteractive();

    // Remove the enemy from the enemies array
    this.enemies = this.enemies.filter((e) => e.sprite !== enemy);

    // Clear highlighted tiles
    this.clearHighlightedTiles();
  }

  spawnEnemies() {
    // Spawn 3 enemies at random locations on the grid
    for (let i = 0; i < 3; i++) {
      const randomX = Phaser.Math.Between(0, this.cols - 1);
      const randomY = Phaser.Math.Between(0, this.rows - 1);

      const enemySprite = this.add.sprite(
        randomX * this.gridSize + this.gridSize / 2,
        randomY * this.gridSize + this.gridSize / 2,
        'enemy'
      );

      enemySprite.setScale(0.4);

      // Create a stats menu (health, mana, experience) for each enemy
      const enemyHealthMenu = this.createStatsMenu(100, 50, 0, enemySprite.x, enemySprite.y - 60);
      enemyHealthMenu.setVisible(false); // Initially hide the health menu

      // Enable hover to show health, mana, and experience menu for enemy
      enemySprite.setInteractive();
      enemySprite.on('pointerover', () => {
        if (enemyHealthMenu) {
          this.updateStatsMenu(enemyHealthMenu, 100, 50, 0); // Assume enemies start with 100 health, 50 mana, 0 experience
          enemyHealthMenu.setVisible(true); // Show stats menu on hover
        }
      });
      enemySprite.on('pointerout', () => {
        if (enemyHealthMenu) {
          enemyHealthMenu.setVisible(false); // Hide stats menu when hover ends
        }
      });

      // Store the enemy's grid position and stats menu
      this.enemies.push({ sprite: enemySprite, health: 100, mana: 50, experience: 0, x: randomX, y: randomY, healthMenu: enemyHealthMenu });
    }
  }

  createStatsMenu(health: number, mana: number, experience: number, x: number, y: number): Phaser.GameObjects.Container {
    const menuBackground = this.add.rectangle(0, 0, 80, 60, 0x333333).setOrigin(0.5);

    // Health bar (red) and label
    const healthBar = this.add.graphics();
    healthBar.fillStyle(0xff0000, 1);
    healthBar.fillRect(-32, -20, 64, 5); // Full width (64 pixels)

    const healthLabel = this.add.text(-32, -30, `${health}/100`, { fontSize: '10px', color: '#fff' });

    // Mana bar (blue) and label
    const manaBar = this.add.graphics();
    manaBar.fillStyle(0x0000ff, 1);
    manaBar.fillRect(-32, -10, 64, 5); // Full width (64 pixels)

    const manaLabel = this.add.text(-32, -20, `${mana}/50`, { fontSize: '10px', color: '#fff' });

    // Experience bar (green) and label
    const experienceBar = this.add.graphics();
    experienceBar.fillStyle(0x00ff00, 1);
    experienceBar.fillRect(-32, 0, 64, 5); // Full width (64 pixels)

    const experienceLabel = this.add.text(-32, -10, `${experience}/100`, { fontSize: '10px', color: '#fff' });

    const statsMenu = this.add.container(x, y, [menuBackground, healthBar, healthLabel, manaBar, manaLabel, experienceBar, experienceLabel]);
    return statsMenu;
  }

  updateStatsMenu(statsMenu: Phaser.GameObjects.Container, health: number, mana: number, experience: number) {
    // Update health bar and label
    const healthBar = statsMenu.getAt(1) as Phaser.GameObjects.Graphics;
    healthBar.clear();
    healthBar.fillStyle(0xff0000, 1);
    healthBar.fillRect(-32, -20, 64, 5); // Full width (64 pixels)

    const healthLabel = statsMenu.getAt(2) as Phaser.GameObjects.Text;
    healthLabel.setText(`${health}/100`);

    // Update mana bar and label
    const manaBar = statsMenu.getAt(3) as Phaser.GameObjects.Graphics;
    manaBar.clear();
    manaBar.fillStyle(0x0000ff, 1);
    manaBar.fillRect(-32, -10, 64, 5); // Full width (64 pixels)

    const manaLabel = statsMenu.getAt(4) as Phaser.GameObjects.Text;
    manaLabel.setText(`${mana}/50`);

    // Update experience bar and label
    const experienceBar = statsMenu.getAt(5) as Phaser.GameObjects.Graphics;
    experienceBar.clear();
    experienceBar.fillStyle(0x00ff00, 1);
    experienceBar.fillRect(-32, 0, 64, 5); // Full width (64 pixels)

    const experienceLabel = statsMenu.getAt(6) as Phaser.GameObjects.Text;
    experienceLabel.setText(`${experience}/100`);
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
