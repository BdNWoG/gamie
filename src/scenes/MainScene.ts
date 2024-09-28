import Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
  private character: Phaser.GameObjects.Sprite | undefined;
  private secondCharacter: Phaser.GameObjects.Sprite | undefined;
  private characterHealth: number = 100;
  private secondCharacterHealth: number = 100;
  private characterMana: number = 50;
  private characterExperience: number = 0;
  private characterLevel: number = 1;
  private characterHealthMenu: Phaser.GameObjects.Container | undefined;
  private secondCharacterHealthMenu: Phaser.GameObjects.Container | undefined;

  private enemies: {
    sprite: Phaser.GameObjects.Sprite,
    health: number,
    mana: number,
    experience: number,
    level: number,
    attributes: { [key: string]: number },
    equipment: { [key: string]: string | null },
    x: number,
    y: number,
    healthMenu: Phaser.GameObjects.Container
  }[] = [];

  private attributeMenu: Phaser.GameObjects.Container | undefined;
  private gridSize: number = 64;
  private rows: number = 40;
  private cols: number = 40;
  private grid: Phaser.GameObjects.Rectangle[][] = [];
  private fogLayer: Phaser.GameObjects.Rectangle[][] = [];
  private fogRadius: number = 10;
  private isDragging: boolean = false;
  private dragStartPoint: { x: number; y: number } = { x: 0, y: 0 };
  private actionMenu: Phaser.GameObjects.Container | undefined;
  private highlightedTiles: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite)[] = [];
  private isAttackMode: boolean = false;
  private targetedEnemy: Phaser.GameObjects.Sprite | undefined;
  private lastClickTime: number = 0;

  // Variables to track the state of the characters' movement during the round
  private hasActed = { character: false, secondCharacter: false };
  private hasMoved = { character: false, secondCharacter: false };
  private nextRoundButton: Phaser.GameObjects.Text | undefined;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    this.load.image('character', 'assets/character.png');
    this.load.image('enemy', 'assets/enemy.png');
  }

  create() {
    document.addEventListener('contextmenu', event => event.preventDefault());

    this.cameras.main.setBounds(0, 0, this.cols * this.gridSize, this.rows * this.gridSize);
    this.physics.world.setBounds(0, 0, this.cols * this.gridSize, this.rows * this.gridSize);
    this.createGrid();

    // Create the main character in the middle of the grid
    this.character = this.add.sprite(
      (this.cols / 2) * this.gridSize + this.gridSize / 2,
      (this.rows / 2) * this.gridSize + this.gridSize / 2,
      'character'
    );
    this.character.setScale(0.4);

    // Create the second character at the center of the first block (top-left)
    this.secondCharacter = this.add.sprite(
      this.gridSize / 2, // X-position (center of the first block)
      this.gridSize / 2, // Y-position (center of the first block)
      'character'
    );
    this.secondCharacter.setScale(0.4);

    // Create stats menu for both characters
    this.characterHealthMenu = this.createStatsMenu(
      this.characterHealth, this.characterMana, this.characterExperience, this.characterLevel, this.character!.x, this.character!.y - 60
    );
    this.characterHealthMenu.setVisible(false);

    this.secondCharacterHealthMenu = this.createStatsMenu(
      this.secondCharacterHealth, this.characterMana, this.characterExperience, this.characterLevel, this.secondCharacter!.x, this.secondCharacter!.y - 60
    );
    this.secondCharacterHealthMenu.setVisible(false);

    // Enable hover and click events for both characters
    this.setupCharacterInteractions(this.character, this.characterHealthMenu, 'character');
    this.setupCharacterInteractions(this.secondCharacter, this.secondCharacterHealthMenu, 'secondCharacter');

    // General input for dragging and camera movement
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startDrag(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.drag(pointer));
    this.input.on('pointerup', () => this.stopDrag());

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number, deltaZ: number) => {
      this.handleZoom(deltaY);
    });

    // Create fog of war and spawn enemies
    this.createFogOfWar();
    this.spawnEnemies();

    // Add the "Next Round" button
    this.addNextRoundButton();
  }

  // Add "Next Round" button to the top right corner
  addNextRoundButton() {
    this.nextRoundButton = this.add.text(this.cameras.main.width - 150, 10, 'Next Round', {
      fontSize: '20px',
      color: '#fff',
      backgroundColor: '#000',
      padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setInteractive();

    this.nextRoundButton.on('pointerdown', () => this.resetForNextRound());
  }

  // Reset characters for the next round and move enemies
  resetForNextRound() {
    this.hasActed.character = false;
    this.hasActed.secondCharacter = false;
    this.hasMoved.character = false;
    this.hasMoved.secondCharacter = false;

    // Reset character appearance and interactivity
    this.character?.clearTint();
    this.secondCharacter?.clearTint();
    this.character?.setInteractive();
    this.secondCharacter?.setInteractive();

    // Move enemies
    this.enemies.forEach(enemy => {
      this.moveEnemyTowardsNearestCharacter(enemy);
    });
  }

  // Setup interaction (hover, left-click, right-click) for characters
  setupCharacterInteractions(
    character: Phaser.GameObjects.Sprite,
    characterHealthMenu: Phaser.GameObjects.Container,
    characterKey: 'character' | 'secondCharacter'
  ) {
    character.setInteractive();

    character.on('pointerover', () => {
      if (characterHealthMenu) {
        this.updateStatsMenu(characterHealthMenu, this.characterHealth, this.characterMana, this.characterExperience, this.characterLevel);
        characterHealthMenu.setVisible(true);
      }
    });

    character.on('pointerout', () => {
      if (characterHealthMenu) {
        characterHealthMenu.setVisible(false);
      }
    });

    // Left-click to show the action menu (only if they haven't acted yet)
    character.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && !this.hasActed[characterKey]) {
        this.showActionMenu(character, characterKey);
      }
    });

    // Right-click to show the attribute menu
    character.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.toggleAttributeMenu(character,
          { ATT: 100, DEF: 100, SPA: 100, SPD: 100, EXP: 100, VIS: 100, LUC: 100, MOV: 100 },
          { primaryWeapon: null, secondaryWeapon: null, specialWeapon: null, ornament: null, helmet: null, chestplate: null, leggings: null, boots: null },
          this.characterLevel
        );
      }
    });
  }

  // Create Grid
  createGrid() {
    for (let row = 0; row < this.rows; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.cols; col++) {
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

  // Create Fog of War
  createFogOfWar() {
    for (let row = 0; row < this.rows; row++) {
      this.fogLayer[row] = [];
      for (let col = 0; col < this.cols; col++) {
        const fogTile = this.add.rectangle(
          col * this.gridSize + this.gridSize / 2,
          row * this.gridSize + this.gridSize / 2,
          this.gridSize,
          this.gridSize,
          0x555555,
          0.7
        ).setDepth(10);
        this.fogLayer[row][col] = fogTile;
      }
    }
    this.updateFogOfWar();
  }

  // Update Fog of War based on character and enemy positions
  updateFogOfWar() {
    const charX = Math.floor(this.character!.x / this.gridSize);
    const charY = Math.floor(this.character!.y / this.gridSize);
    const secondCharX = Math.floor(this.secondCharacter!.x / this.gridSize);
    const secondCharY = Math.floor(this.secondCharacter!.y / this.gridSize);

    // Loop through all tiles to update fog visibility
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const distanceFromMainChar = Math.abs(col - charX) + Math.abs(row - charY);
        const distanceFromSecondChar = Math.abs(col - secondCharX) + Math.abs(row - secondCharY);

        if (distanceFromMainChar <= this.fogRadius || distanceFromSecondChar <= this.fogRadius) {
          this.fogLayer[row][col].setVisible(false); // Clear fog
        } else {
          this.fogLayer[row][col].setVisible(true); // Set fog
        }
      }
    }

    this.enemies.forEach(({ sprite, x, y }) => {
      const distanceFromMainChar = Math.abs(x - charX) + Math.abs(y - charY);
      const distanceFromSecondChar = Math.abs(x - secondCharX) + Math.abs(y - secondCharY);

      // If the enemy is within fogRadius of either character, show it
      if (distanceFromMainChar <= this.fogRadius || distanceFromSecondChar <= this.fogRadius) {
        sprite.setVisible(true);
        sprite.setInteractive();
      } else {
        sprite.setVisible(false);
        sprite.disableInteractive();
      }
    });
  }

  // Create Stats Menu
  createStatsMenu(health: number, mana: number, experience: number, level: number, x: number, y: number): Phaser.GameObjects.Container {
    const maxHealth = 100;
    const maxMana = 50;
    const maxExperience = 100;

    const menuBackground = this.add.rectangle(0, 0, 80, 70, 0x333333).setOrigin(0.5);

    const levelText = this.add.text(-32, -40, `Lv: ${level}`, { fontSize: '10px', color: '#fff' });

    const healthBar = this.add.graphics();
    healthBar.fillStyle(0xff0000, 1);
    healthBar.fillRect(-32, -20, (health / maxHealth) * 64, 5);

    const healthLabel = this.add.text(-32, -30, `${health}/${maxHealth}`, { fontSize: '10px', color: '#fff' });

    const manaBar = this.add.graphics();
    manaBar.fillStyle(0x0000ff, 1);
    manaBar.fillRect(-32, -10, (mana / maxMana) * 64, 5);

    const manaLabel = this.add.text(-32, -20, `${mana}/${maxMana}`, { fontSize: '10px', color: '#fff' });

    const experienceBar = this.add.graphics();
    experienceBar.fillStyle(0x00ff00, 1);
    experienceBar.fillRect(-32, 0, (experience / maxExperience) * 64, 5);

    const experienceLabel = this.add.text(-32, -10, `${experience}/${maxExperience}`, { fontSize: '10px', color: '#fff' });

    const statsMenu = this.add.container(x, y, [menuBackground, levelText, healthBar, healthLabel, manaBar, manaLabel, experienceBar, experienceLabel]);
    return statsMenu;
  }

  updateStatsMenu(statsMenu: Phaser.GameObjects.Container, health: number, mana: number, experience: number, level: number) {
    const maxHealth = 100;
    const maxMana = 50;
    const maxExperience = 100;

    const levelText = statsMenu.getAt(1) as Phaser.GameObjects.Text;
    levelText.setText(`Lv: ${level}`);

    const healthBar = statsMenu.getAt(2) as Phaser.GameObjects.Graphics;
    healthBar.clear();
    healthBar.fillStyle(0xff0000, 1);
    healthBar.fillRect(-32, -20, (health / maxHealth) * 64, 5);

    const healthLabel = statsMenu.getAt(3) as Phaser.GameObjects.Text;
    healthLabel.setText(`${health}/${maxHealth}`);

    const manaBar = statsMenu.getAt(4) as Phaser.GameObjects.Graphics;
    manaBar.clear();
    manaBar.fillStyle(0x0000ff, 1);
    manaBar.fillRect(-32, -10, (mana / maxMana) * 64, 5);

    const manaLabel = statsMenu.getAt(5) as Phaser.GameObjects.Text;
    manaLabel.setText(`${mana}/${maxMana}`);

    const experienceBar = statsMenu.getAt(6) as Phaser.GameObjects.Graphics;
    experienceBar.clear();
    experienceBar.fillStyle(0x00ff00, 1);
    experienceBar.fillRect(-32, 0, (experience / maxExperience) * 64, 5);

    const experienceLabel = statsMenu.getAt(7) as Phaser.GameObjects.Text;
    experienceLabel.setText(`${experience}/${maxExperience}`);
  }

  // Toggle Attribute Menu
  toggleAttributeMenu(sprite: Phaser.GameObjects.Sprite, attributes: { [key: string]: number }, equipment: { [key: string]: string | null }, level: number) {
    if (this.attributeMenu) {
      this.attributeMenu.destroy();
      this.attributeMenu = undefined;
    } else {
      this.createAttributeMenu(sprite, attributes, equipment, level);
    }
  }

  // Create Attribute Menu
  createAttributeMenu(sprite: Phaser.GameObjects.Sprite, attributes: { [key: string]: number }, equipment: { [key: string]: string | null }, level: number) {
    const menuWidth = 300;
    const menuHeight = 300;
    const menuBackground = this.add.rectangle(0, 0, menuWidth, menuHeight, 0x333333).setOrigin(0);

    const attributeText = [
      `ATT: ${attributes.ATT}`, `DEF: ${attributes.DEF}`,
      `SPA: ${attributes.SPA}`, `SPD: ${attributes.SPD}`,
      `EXP: ${attributes.EXP}`, `VIS: ${attributes.VIS}`,
      `LUC: ${attributes.LUC}`, `MOV: ${attributes.MOV}`
    ];

    let xPos = 10;
    let yPos = 10;
    const attrTextObjects = attributeText.map((attr, index) => {
      const text = this.add.text(xPos, yPos, attr, { fontSize: '14px', color: '#fff' });
      if (index % 2 === 1) {
        yPos += 30;
        xPos = 10;
      } else {
        xPos += 130;
      }
      return text;
    });

    const equipmentLabels = ['Primary Weapon', 'Secondary Weapon', 'Special Weapon', 'Ornament', 'Helmet', 'Chestplate', 'Leggings', 'Boots'];
    const equipmentSlots = equipmentLabels.map((label, index) => {
      const equipmentLabel = this.add.text(10 + (index % 2) * 130, 150 + Math.floor(index / 2) * 40, label, { fontSize: '14px', color: '#fff' });
      const equipmentBox = this.add.rectangle(120 + (index % 2) * 130, 160 + Math.floor(index / 2) * 40, 50, 30, 0x777777).setStrokeStyle(1, 0xffffff);
      return [equipmentLabel, equipmentBox];
    });

    const levelText = this.add.text(10, 110, `Level: ${level}`, { fontSize: '14px', color: '#fff' });

    this.attributeMenu = this.add.container(sprite.x, sprite.y, [menuBackground, levelText, ...attrTextObjects, ...equipmentSlots.flat()]);
  }

  // Show Action Menu
  showActionMenu(character: Phaser.GameObjects.Sprite, characterKey: 'character' | 'secondCharacter') {
    if (this.actionMenu) {
      this.actionMenu.destroy();
      this.actionMenu = undefined;
    }

    const menuWidth = 120;
    const menuHeight = 180;
    const menuBackground = this.add.rectangle(0, 0, menuWidth, menuHeight, 0x333333).setOrigin(0);
    const textStyle = { fontSize: '16px', color: '#fff' };

    const moveText = this.add.text(menuWidth / 2, 10, 'Move', textStyle).setOrigin(0.5);
    const attackText = this.add.text(menuWidth / 2, 40, 'Attack', textStyle).setOrigin(0.5);
    const specialText = this.add.text(menuWidth / 2, 70, 'Special', textStyle).setOrigin(0.5);
    const cancelText = this.add.text(menuWidth / 2, 100, 'Cancel', textStyle).setOrigin(0.5);

    this.actionMenu = this.add.container(character.x, character.y, [
      menuBackground,
      moveText,
      attackText,
      specialText,
      cancelText
    ]);

    // Disable the "Move" button if the character has already moved
    if (this.hasMoved[characterKey]) {
      moveText.setTint(0x888888); // Grey out
      moveText.disableInteractive(); // Disable interaction
    }

    // Add interaction to menu items
    moveText.setInteractive().on('pointerdown', () => {
      if (!this.hasMoved[characterKey]) {
        this.highlightMovableTiles(character);
        this.actionMenu?.destroy();
        this.hasActed[characterKey] = true;  // Mark as acted
        this.hasMoved[characterKey] = true;  // Mark as moved
        this.greyOutCharacter(character); // Grey out the character after action
      }
    });

    attackText.setInteractive().on('pointerdown', () => {
      this.isAttackMode = true;
      this.highlightEnemyBlocks(character);
      this.actionMenu?.destroy();
      this.hasActed[characterKey] = true;  // Mark as acted
      this.greyOutCharacter(character); // Grey out the character after action
    });

    specialText.setInteractive().on('pointerdown', () => {
      console.log("Special action triggered");
      this.actionMenu?.destroy();
      this.hasActed[characterKey] = true;  // Mark as acted
      this.greyOutCharacter(character); // Grey out the character after action
    });

    cancelText.setInteractive().on('pointerdown', () => {
      this.isAttackMode = false;
      this.clearHighlightedTiles();
      this.actionMenu?.destroy();
    });
  }

  // Grey out the character to show it can't be used again this round
  greyOutCharacter(character: Phaser.GameObjects.Sprite) {
    character.setTint(0x888888);
    character.removeInteractive(); // Disable interaction
  }

  // Handle Movement
  highlightMovableTiles(character: Phaser.GameObjects.Sprite) {
    this.clearHighlightedTiles();

    const charX = Math.floor(character.x / this.gridSize);
    const charY = Math.floor(character.y / this.gridSize);

    for (let row = Math.max(0, charY - 3); row <= Math.min(this.rows - 1, charY + 3); row++) {
      for (let col = Math.max(0, charX - 3); col <= Math.min(this.cols - 1, charX + 3); col++) {
        const distance = Math.abs(col - charX) + Math.abs(row - charY);
        if (distance <= 3) {
          const tile = this.grid[row][col];
          tile.setFillStyle(0x888888);
          this.highlightedTiles.push(tile);

          tile.setInteractive();
          tile.on('pointerdown', () => this.moveCharacter(character, col, row));
        }
      }
    }
  }

  // Move Character
  moveCharacter(character: Phaser.GameObjects.Sprite, targetCol: number, targetRow: number) {
    character.setPosition(
      targetCol * this.gridSize + this.gridSize / 2,
      targetRow * this.gridSize + this.gridSize / 2
    );

    // Update fog of war after movement
    this.updateFogOfWar();

    if (character === this.character && this.characterHealthMenu) {
      this.characterHealthMenu.setPosition(character.x, character.y - 60);
    }

    if (character === this.secondCharacter && this.secondCharacterHealthMenu) {
      this.secondCharacterHealthMenu.setPosition(character.x, character.y - 60);
    }

    // After moving, show the action menu again with the move button disabled
    this.showActionMenu(character, character === this.character ? 'character' : 'secondCharacter');

    this.clearHighlightedTiles();
  }

  // Highlight Enemies for Attack
  highlightEnemyBlocks(character: Phaser.GameObjects.Sprite) {
    this.clearHighlightedTiles();

    const charX = Math.floor(character.x / this.gridSize);
    const charY = Math.floor(character.y / this.gridSize);

    this.enemies.forEach(({ sprite, x, y }) => {
      const distance = Math.abs(x - charX) + Math.abs(y - charY);

      if (distance <= 1) {
        sprite.setTint(0xff0000); // Highlight enemy in red
        this.highlightedTiles.push(sprite); // Add the sprite to highlightedTiles

        sprite.setInteractive();
        sprite.once('pointerdown', () => {
          if (this.isAttackMode) {
            this.attackEnemy(sprite); // Attack the enemy
          }
        });
      }
    });
  }

  // Attack Enemy
  attackEnemy(enemySprite: Phaser.GameObjects.Sprite) {
    const enemy = this.enemies.find(e => e.sprite === enemySprite);

    if (enemy) {
      enemy.health -= 20;
      if (enemy.health <= 0) {
        this.killEnemy(enemySprite, this.grid[enemy.y][enemy.x], enemy.healthMenu);
      } else {
        this.updateStatsMenu(enemy.healthMenu, enemy.health, enemy.mana, enemy.experience, enemy.level);

        // Show the health menu briefly after an attack
        enemy.healthMenu.setVisible(true);
        this.time.delayedCall(1000, () => {
          enemy.healthMenu.setVisible(false);
        });
      }
    }

    this.isAttackMode = false;
    this.clearHighlightedTiles();
  }

  // Kill Enemy
  killEnemy(enemy: Phaser.GameObjects.Sprite, tile: Phaser.GameObjects.Rectangle, healthMenu: Phaser.GameObjects.Container) {
    // Clear interactions and highlights for the enemy
    if (enemy.input) {
        enemy.removeInteractive();  // Remove interactivity first, if input exists
    }

    // Remove the enemy from the highlighted tiles array if it's there
    this.highlightedTiles = this.highlightedTiles.filter(item => item !== enemy);

    // Destroy the health menu and enemy sprite
    healthMenu.destroy();
    enemy.destroy();

    // Remove the tile's interactive state and reset its appearance
    tile.setFillStyle(0x000000);
    tile.removeInteractive();

    // Remove the enemy from the enemies array
    this.enemies = this.enemies.filter(e => e.sprite !== enemy);

    // Clear highlighted tiles after the enemy is killed
    this.clearHighlightedTiles();
  }

  // Spawn Enemies
  spawnEnemies() {
    for (let i = 0; i < 10; i++) {
      const randomX = Phaser.Math.Between(0, this.cols - 1);
      const randomY = Phaser.Math.Between(0, this.rows - 1);

      // Ensure the enemy does not spawn on a character
      if (this.isTileOccupiedByCharacter(randomX, randomY)) {
        i--; // Retry spawning
        continue;
      }

      const enemySprite = this.add.sprite(randomX * this.gridSize + this.gridSize / 2, randomY * this.gridSize + this.gridSize / 2, 'enemy');
      enemySprite.setScale(0.4);

      const attributes = {
        ATT: Phaser.Math.Between(50, 150), DEF: Phaser.Math.Between(50, 150),
        SPA: Phaser.Math.Between(50, 150), SPD: Phaser.Math.Between(50, 150),
        EXP: Phaser.Math.Between(0, 100), VIS: Phaser.Math.Between(50, 150),
        LUC: Phaser.Math.Between(50, 150), MOV: Phaser.Math.Between(50, 150)
      };

      const equipment = {
        primaryWeapon: null, secondaryWeapon: null, specialWeapon: null, ornament: null,
        helmet: null, chestplate: null, leggings: null, boots: null
      };

      enemySprite.setInteractive();
      enemySprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          this.toggleAttributeMenu(enemySprite, attributes, equipment, 1);
        }
      });

      const enemyHealthMenu = this.createStatsMenu(100, 50, 0, 1, enemySprite.x, enemySprite.y - 60);
      enemyHealthMenu.setVisible(false);

      enemySprite.on('pointerover', () => {
        this.updateStatsMenu(enemyHealthMenu, 100, 50, 0, 1);
        enemyHealthMenu.setVisible(true);
      });
      enemySprite.on('pointerout', () => {
        enemyHealthMenu.setVisible(false);
      });

      this.enemies.push({ sprite: enemySprite, health: 100, mana: 50, experience: 0, level: 1, attributes, equipment, x: randomX, y: randomY, healthMenu: enemyHealthMenu });
    }
    this.updateFogOfWar();
  }

  // Check if a tile is occupied by a character
  isTileOccupiedByCharacter(x: number, y: number): boolean {
    const charX = Math.floor(this.character!.x / this.gridSize);
    const charY = Math.floor(this.character!.y / this.gridSize);
    const secondCharX = Math.floor(this.secondCharacter!.x / this.gridSize);
    const secondCharY = Math.floor(this.secondCharacter!.y / this.gridSize);

    return (x === charX && y === charY) || (x === secondCharX && y === secondCharY);
  }

  // Enemy movement towards nearest character using Dijkstra's algorithm
  moveEnemyTowardsNearestCharacter(enemy: any) {
    const nearestCharacter = this.getNearestCharacter(enemy);
    if (!nearestCharacter) return;

    const path = this.findShortestPath(enemy, nearestCharacter);
    if (path.length > 1) {
      const nextStep = path[1];
      enemy.sprite.setPosition(nextStep.col * this.gridSize + this.gridSize / 2, nextStep.row * this.gridSize + this.gridSize / 2);
      enemy.x = nextStep.col;
      enemy.y = nextStep.row;

      // If adjacent to the character, attack
      if (Math.abs(nextStep.col - nearestCharacter.x) + Math.abs(nextStep.row - nearestCharacter.y) === 1) {
        this.attackCharacter(nearestCharacter.key);
      }
    }
    this.updateFogOfWar();
  }

  // Find nearest character (Dijkstra's)
  getNearestCharacter(enemy: any) {
    const characters = [
      { sprite: this.character, x: Math.floor(this.character!.x / this.gridSize), y: Math.floor(this.character!.y / this.gridSize), key: 'character' },
      { sprite: this.secondCharacter, x: Math.floor(this.secondCharacter!.x / this.gridSize), y: Math.floor(this.secondCharacter!.y / this.gridSize), key: 'secondCharacter' }
    ];
    return characters.reduce((nearest, char) => {
      const dist = Math.abs(char.x - enemy.x) + Math.abs(char.y - enemy.y);
      if (!nearest || dist < Math.abs(nearest.x - enemy.x) + Math.abs(nearest.y - enemy.y)) {
        return char;
      }
      return nearest;
    }, null as any);
  }

  // Find shortest path using Dijkstra's algorithm
  findShortestPath(enemy: any, character: any) {
    const dist: number[][] = Array(this.rows).fill(null).map(() => Array(this.cols).fill(Infinity));
    const prev: { row: number; col: number }[][] = Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));

    const queue = [{ row: enemy.y, col: enemy.x }];
    dist[enemy.y][enemy.x] = 0;

    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      const currentDist = dist[row][col];

      const neighbors = [
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 }
      ].filter(n => n.row >= 0 && n.row < this.rows && n.col >= 0 && n.col < this.cols);

      neighbors.forEach(n => {
        if (dist[n.row][n.col] > currentDist + 1) {
          dist[n.row][n.col] = currentDist + 1;
          prev[n.row][n.col] = { row, col };
          queue.push(n);
        }
      });
    }

    const path: { row: number; col: number }[] = [];
    let current = { row: character.y, col: character.x };
    while (current && (current.row !== enemy.y || current.col !== enemy.x)) {
      path.push(current);
      current = prev[current.row][current.col];
    }
    path.reverse();
    return path;
  }

  // Character takes damage
  attackCharacter(characterKey: 'character' | 'secondCharacter') {
    if (characterKey === 'character') {
      this.characterHealth -= 10;
      this.updateStatsMenu(this.characterHealthMenu!, this.characterHealth, this.characterMana, this.characterExperience, this.characterLevel);
      if (this.characterHealth <= 0) {
        this.character?.destroy();
      }
    } else {
      this.secondCharacterHealth -= 10;
      this.updateStatsMenu(this.secondCharacterHealthMenu!, this.secondCharacterHealth, this.characterMana, this.characterExperience, this.characterLevel);
      if (this.secondCharacterHealth <= 0) {
        this.secondCharacter?.destroy();
      }
    }
  }

  // Clear Highlighted Tiles
  clearHighlightedTiles() {
    this.highlightedTiles.forEach((tileOrSprite) => {
      if (tileOrSprite instanceof Phaser.GameObjects.Rectangle) {
        tileOrSprite.setFillStyle(0x000000);
        tileOrSprite.removeInteractive();
      } else if (tileOrSprite instanceof Phaser.GameObjects.Sprite) {
        tileOrSprite.clearTint();
        tileOrSprite.removeInteractive();
      }
    });

    this.highlightedTiles = [];
  }

  // Dragging and zoom functionality remains the same
  startDrag(pointer: Phaser.Input.Pointer) {
    this.isDragging = true;
    this.dragStartPoint.x = pointer.x;
    this.dragStartPoint.y = pointer.y;
  }

  drag(pointer: Phaser.Input.Pointer) {
    if (this.isDragging) {
      const dragDistanceX = this.dragStartPoint.x - pointer.x;
      const dragDistanceY = this.dragStartPoint.y - pointer.y;

      this.cameras.main.scrollX += dragDistanceX;
      this.cameras.main.scrollY += dragDistanceY;

      this.dragStartPoint.x = pointer.x;
      this.dragStartPoint.y = pointer.y;
    }
  }

  stopDrag() {
    this.isDragging = false;
  }

  handleZoom(deltaY: number) {
    const zoomFactor = this.cameras.main.zoom - deltaY * 0.001;
    this.cameras.main.setZoom(Phaser.Math.Clamp(zoomFactor, 0.5, 2));
  }
}
