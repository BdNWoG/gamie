import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
  private character: Phaser.GameObjects.Sprite | undefined;
  private characterHealth: number = 100;
  private characterMana: number = 50;
  private characterExperience: number = 0;
  private characterLevel: number = 1;
  private characterHealthMenu: Phaser.GameObjects.Container | undefined;

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
  private isDragging: boolean = false;
  private dragStartPoint: { x: number; y: number } = { x: 0, y: 0 };
  private actionMenu: Phaser.GameObjects.Container | undefined;
  private highlightedTiles: Phaser.GameObjects.Rectangle[] = [];
  private lastClickTime: number = 0;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    this.load.image('character', 'assets/character.png');
    this.load.image('enemy', 'assets/enemy.png');
  }

  create() {
    // Prevent the default context menu from appearing when right-clicking
    document.addEventListener('contextmenu', event => event.preventDefault());

    this.cameras.main.setBounds(0, 0, this.cols * this.gridSize, this.rows * this.gridSize);
    this.physics.world.setBounds(0, 0, this.cols * this.gridSize, this.rows * this.gridSize);
    this.createGrid();

    // Create the character in the center of the grid
    this.character = this.add.sprite(
      (this.cols / 2) * this.gridSize + this.gridSize / 2,
      (this.rows / 2) * this.gridSize + this.gridSize / 2,
      'character'
    );
    this.character.setScale(0.4);

    // Create a stats menu for the character, including the Level
    this.characterHealthMenu = this.createStatsMenu(
      this.characterHealth, this.characterMana, this.characterExperience, this.characterLevel, this.character!.x, this.character!.y - 60
    );
    this.characterHealthMenu.setVisible(false);

    // Enable hover to show health, mana, experience, and level menu for the character
    this.character.setInteractive();
    this.character.on('pointerover', () => {
      if (this.characterHealthMenu) {
        this.updateStatsMenu(this.characterHealthMenu, this.characterHealth, this.characterMana, this.characterExperience, this.characterLevel);
        this.characterHealthMenu.setVisible(true);
      }
    });
    this.character.on('pointerout', () => {
      if (this.characterHealthMenu) {
        this.characterHealthMenu.setVisible(false);
      }
    });

    // Left-click for the action menu
    this.character.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.showActionMenu();
      }
    });

    // Right-click for the attribute menu
    this.character.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.toggleAttributeMenu(this.character!, { ATT: 100, DEF: 100, SPA: 100, SPD: 100, EXP: 100, VIS: 100, LUC: 100, MOV: 100 }, { primaryWeapon: null, secondaryWeapon: null, specialWeapon: null, ornament: null, helmet: null, chestplate: null, leggings: null, boots: null }, this.characterLevel);
      }
    });

    // General input for dragging and camera movement
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startDrag(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.drag(pointer));
    this.input.on('pointerup', () => this.stopDrag());

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number, deltaZ: number) => {
      this.handleZoom(deltaY);
    });

    // Spawn enemies
    this.spawnEnemies();
  }

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

  toggleAttributeMenu(sprite: Phaser.GameObjects.Sprite, attributes: { [key: string]: number }, equipment: { [key: string]: string | null }, level: number) {
    // If the attribute menu is already open, close it
    if (this.attributeMenu) {
      this.attributeMenu.destroy();
      this.attributeMenu = undefined;
    } else {
      // If no attribute menu is open, create one
      this.createAttributeMenu(sprite, attributes, equipment, level);
    }
  }

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

  showActionMenu() {
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
    const holdText = this.add.text(menuWidth / 2, 100, 'Hold', textStyle).setOrigin(0.5);
    const cancelText = this.add.text(menuWidth / 2, 130, 'Cancel', textStyle).setOrigin(0.5);

    this.actionMenu = this.add.container(this.character?.x || 0, this.character?.y || 0, [
      menuBackground,
      moveText,
      attackText,
      specialText,
      holdText,
      cancelText
    ]);

    moveText.setInteractive();
    moveText.on('pointerdown', () => {
      this.highlightMovableTiles();
      this.actionMenu?.destroy();
    });

    attackText.setInteractive();
    attackText.on('pointerdown', () => {
      this.highlightEnemyBlocks();
      this.actionMenu?.destroy();
    });

    specialText.setInteractive();
    specialText.on('pointerdown', () => {
      this.handleSpecialAction();
      this.actionMenu?.destroy();
    });

    holdText.setInteractive();
    holdText.on('pointerdown', () => {
      this.handleHoldAction();
      this.actionMenu?.destroy();
    });

    cancelText.setInteractive();
    cancelText.on('pointerdown', () => {
      this.actionMenu?.destroy();
    });
  }

  handleSpecialAction() {
    console.log("Special action triggered!");
  }

  handleHoldAction() {
    console.log("Hold action triggered!");
  }

  highlightMovableTiles() {
    this.clearHighlightedTiles();

    const charX = Math.floor(this.character!.x / this.gridSize);
    const charY = Math.floor(this.character!.y / this.gridSize);

    for (let row = Math.max(0, charY - 2); row <= Math.min(this.rows - 1, charY + 2); row++) {
      for (let col = Math.max(0, charX - 2); col <= Math.min(this.cols - 1, charX + 2); col++) {
        const distance = Math.abs(col - charX) + Math.abs(row - charY);
        if (distance <= 2) {
          const tile = this.grid[row][col];
          tile.setFillStyle(0x888888);
          this.highlightedTiles.push(tile);

          tile.setInteractive();
          tile.on('pointerdown', () => this.moveCharacter(col, row));
        }
      }
    }
  }

  clearHighlightedTiles() {
    this.highlightedTiles.forEach((tile) => {
      tile.setFillStyle(0x000000);
      tile.removeInteractive();
    });
    this.highlightedTiles = [];
  }

  moveCharacter(targetCol: number, targetRow: number) {
    if (this.character) {
      this.character.setPosition(
        targetCol * this.gridSize + this.gridSize / 2,
        targetRow * this.gridSize + this.gridSize / 2
      );

      if (this.characterHealthMenu) {
        this.characterHealthMenu.setPosition(this.character.x, this.character.y - 60);
      }

      this.clearHighlightedTiles();
    }
  }

  highlightEnemyBlocks() {
    this.clearHighlightedTiles();

    const charX = Math.floor(this.character!.x / this.gridSize);
    const charY = Math.floor(this.character!.y / this.gridSize);

    this.enemies.forEach(({ sprite, x, y, healthMenu }) => {
      const distance = Math.abs(x - charX) + Math.abs(y - charY);
      if (distance === 1) {
        const tile = this.grid[y][x];
        tile.setFillStyle(0xff0000);
        this.highlightedTiles.push(tile);

        tile.setInteractive();
        tile.once('pointerdown', () => {
          this.killEnemy(sprite, tile, healthMenu);
        });
      }
    });
  }

  killEnemy(enemy: Phaser.GameObjects.Sprite, tile: Phaser.GameObjects.Rectangle, healthMenu: Phaser.GameObjects.Container) {
    enemy.destroy();
    healthMenu.destroy();

    tile.setFillStyle(0x000000);
    tile.removeInteractive();

    this.enemies = this.enemies.filter((e) => e.sprite !== enemy);
    this.clearHighlightedTiles();
  }

  spawnEnemies() {
    for (let i = 0; i < 3; i++) {
      const randomX = Phaser.Math.Between(0, this.cols - 1);
      const randomY = Phaser.Math.Between(0, this.rows - 1);

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
        this.updateStatsMenu(enemyHealthMenu, 100, 50, 0, 1); // Assume enemies start at level 1
        enemyHealthMenu.setVisible(true);
      });
      enemySprite.on('pointerout', () => {
        enemyHealthMenu.setVisible(false);
      });

      this.enemies.push({ sprite: enemySprite, health: 100, mana: 50, experience: 0, level: 1, attributes, equipment, x: randomX, y: randomY, healthMenu: enemyHealthMenu });
    }
  }

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
  window.game = new Phaser.Game(config);
};
