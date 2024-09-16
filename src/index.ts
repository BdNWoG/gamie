import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
  private character: Phaser.GameObjects.Sprite | undefined;
  private secondCharacter: Phaser.GameObjects.Sprite | undefined;
  private characterHealth: number = 100;
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
  private grid: Phaser.GameObjects.Rectangle[][] = []; // Declare grid properly
  private fogLayer: Phaser.GameObjects.Rectangle[][] = []; // Fog of war layer
  private fogRadius: number = 10; // Radius of visibility in blocks
  private isDragging: boolean = false;
  private dragStartPoint: { x: number; y: number } = { x: 0, y: 0 };
  private actionMenu: Phaser.GameObjects.Container | undefined;
  private highlightedTiles: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite)[] = []; // Modified for both rectangles and sprites
  private isAttackMode: boolean = false; // Attack mode flag
  private targetedEnemy: Phaser.GameObjects.Sprite | undefined; // Targeted enemy
  private lastClickTime: number = 0;

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

    this.character = this.add.sprite(
      (this.cols / 2) * this.gridSize + this.gridSize / 2,
      (this.rows / 2) * this.gridSize + this.gridSize / 2,
      'character'
    );
    this.character.setScale(0.4);

    this.secondCharacter = this.add.sprite(0, 0, 'character');
    this.secondCharacter.setScale(0.4);

    this.characterHealthMenu = this.createStatsMenu(
      this.characterHealth, this.characterMana, this.characterExperience, this.characterLevel, this.character!.x, this.character!.y - 60
    );
    this.characterHealthMenu.setVisible(false);

    this.secondCharacterHealthMenu = this.createStatsMenu(
      this.characterHealth, this.characterMana, this.characterExperience, this.characterLevel, this.secondCharacter!.x, this.secondCharacter!.y - 60
    );
    this.secondCharacterHealthMenu.setVisible(false);

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

    this.secondCharacter.setInteractive();
    this.secondCharacter.on('pointerover', () => {
      if (this.secondCharacterHealthMenu) {
        this.updateStatsMenu(this.secondCharacterHealthMenu, this.characterHealth, this.characterMana, this.characterExperience, this.characterLevel);
        this.secondCharacterHealthMenu.setVisible(true);
      }
    });
    this.secondCharacter.on('pointerout', () => {
      if (this.secondCharacterHealthMenu) {
        this.secondCharacterHealthMenu.setVisible(false);
      }
    });

    this.character?.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && this.character) {
        this.showActionMenu(this.character);
      }
    });

    this.secondCharacter?.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && this.secondCharacter) {
        this.showActionMenu(this.secondCharacter);
      }
    });

    this.character.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.toggleAttributeMenu(this.character!, { ATT: 100, DEF: 100, SPA: 100, SPD: 100, EXP: 100, VIS: 100, LUC: 100, MOV: 100 }, { primaryWeapon: null, secondaryWeapon: null, specialWeapon: null, ornament: null, helmet: null, chestplate: null, leggings: null, boots: null }, this.characterLevel);
      }
    });

    this.secondCharacter.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.toggleAttributeMenu(this.secondCharacter!, { ATT: 100, DEF: 100, SPA: 100, SPD: 100, EXP: 100, VIS: 100, LUC: 100, MOV: 100 }, { primaryWeapon: null, secondaryWeapon: null, specialWeapon: null, ornament: null, helmet: null, chestplate: null, leggings: null, boots: null }, this.characterLevel);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startDrag(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.drag(pointer));
    this.input.on('pointerup', () => this.stopDrag());

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number, deltaZ: number) => {
      this.handleZoom(deltaY);
    });

    this.createFogOfWar();
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

  updateFogOfWar() {
    const charX = Math.floor(this.character!.x / this.gridSize);
    const charY = Math.floor(this.character!.y / this.gridSize);
    const secondCharX = Math.floor(this.secondCharacter!.x / this.gridSize);
    const secondCharY = Math.floor(this.secondCharacter!.y / this.gridSize);

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const distance1 = Math.abs(col - charX) + Math.abs(row - charY);
        const distance2 = Math.abs(col - secondCharX) + Math.abs(row - secondCharY);
        if (distance1 <= this.fogRadius || distance2 <= this.fogRadius) {
          this.fogLayer[row][col].setVisible(false);
        } else {
          this.fogLayer[row][col].setVisible(true);
        }
      }
    }

    this.enemies.forEach(({ sprite, x, y }) => {
      const distance1 = Math.abs(x - charX) + Math.abs(y - charY);
      const distance2 = Math.abs(x - secondCharX) + Math.abs(y - secondCharY);
      if (distance1 <= this.fogRadius || distance2 <= this.fogRadius) {
        sprite.setVisible(true);
        sprite.setInteractive();
      } else {
        sprite.setVisible(false);
        sprite.disableInteractive();
      }
    });
  }

  toggleAttributeMenu(sprite: Phaser.GameObjects.Sprite, attributes: { [key: string]: number }, equipment: { [key: string]: string | null }, level: number) {
    if (this.attributeMenu) {
      this.attributeMenu.destroy();
      this.attributeMenu = undefined;
    } else {
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

  showActionMenu(character: Phaser.GameObjects.Sprite) {
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

    this.actionMenu = this.add.container(character.x || 0, character.y || 0, [
      menuBackground,
      moveText,
      attackText,
      specialText,
      holdText,
      cancelText
    ]);

    moveText.setInteractive();
    moveText.on('pointerdown', () => {
      this.highlightMovableTiles(character);
      this.actionMenu?.destroy();
    });

    attackText.setInteractive();
    attackText.on('pointerdown', () => {
      this.isAttackMode = true;
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
      this.isAttackMode = false;
      this.clearHighlightedTiles();
      this.actionMenu?.destroy();
    });
  }

  handleSpecialAction() {
    console.log("Special action triggered!");
  }

  handleHoldAction() {
    console.log("Hold action triggered!");
  }

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

  highlightEnemyBlocks() {
    this.clearHighlightedTiles();

    this.enemies.forEach(({ sprite, x, y }) => {
      const charX = Math.floor(this.character!.x / this.gridSize);
      const charY = Math.floor(this.character!.y / this.gridSize);
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

  attackEnemy(enemySprite: Phaser.GameObjects.Sprite) {
    const enemy = this.enemies.find(e => e.sprite === enemySprite);
  
    if (enemy) {
      enemy.health -= 20;
  
      // Update stats menu or close if the enemy is dead
      if (enemy.health <= 0) {
        this.killEnemy(enemySprite, this.grid[enemy.y][enemy.x], enemy.healthMenu);
      } else {
        this.updateStatsMenu(enemy.healthMenu, enemy.health, enemy.mana, enemy.experience, enemy.level);
      }
  
      // Hide the stats menu after attack
      enemy.healthMenu.setVisible(false);
    }
  
    // Reset attack mode after the attack
    this.isAttackMode = false;
    this.clearHighlightedTiles();
  
    // Re-enable hover functionality for the enemy sprite
    enemySprite.on('pointerover', () => {
      if (enemy?.healthMenu) {
        this.updateStatsMenu(enemy.healthMenu, enemy.health, enemy.mana, enemy.experience, enemy.level);
        enemy.healthMenu.setVisible(true);
      }
    });
  
    enemySprite.on('pointerout', () => {
      if (enemy?.healthMenu) {
        enemy.healthMenu.setVisible(false);
      }
    });
  }

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

  moveCharacter(character: Phaser.GameObjects.Sprite, targetCol: number, targetRow: number) {
    character.setPosition(
      targetCol * this.gridSize + this.gridSize / 2,
      targetRow * this.gridSize + this.gridSize / 2
    );

    if (character === this.character && this.characterHealthMenu) {
      this.characterHealthMenu.setPosition(character.x, character.y - 60);
      this.updateFogOfWar();
    }

    if (character === this.secondCharacter && this.secondCharacterHealthMenu) {
      this.secondCharacterHealthMenu.setPosition(character.x, character.y - 60);
    }

    this.clearHighlightedTiles();
  }

  killEnemy(enemy: Phaser.GameObjects.Sprite, tile: Phaser.GameObjects.Rectangle, healthMenu: Phaser.GameObjects.Container) {
    // Clear interactions and highlights for the enemy
    if (enemy.input) {
      enemy.removeInteractive(); // Remove interactivity first, if input exists
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

  spawnEnemies() {
    for (let i = 0; i < 10; i++) {
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
