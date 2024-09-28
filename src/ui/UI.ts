import Phaser from 'phaser';

export function createStatsMenu(
  scene: Phaser.Scene,
  health: number, mana: number, experience: number, level: number, x: number, y: number
): Phaser.GameObjects.Container {
  const maxHealth = 100;
  const maxMana = 50;
  const maxExperience = 100;

  const menuElements = [
    scene.add.rectangle(0, 0, 80, 70, 0x333333).setOrigin(0.5),
    scene.add.text(-32, -40, `Lv: ${level}`, { fontSize: '10px', color: '#fff' }),
    createBar(scene, health, maxHealth, 0xff0000, -32, -20),
    createBar(scene, mana, maxMana, 0x0000ff, -32, -10),
    createBar(scene, experience, maxExperience, 0x00ff00, -32, 0)
  ];

  return scene.add.container(x, y, menuElements);
}

function createBar(scene: Phaser.Scene, value: number, maxValue: number, color: number, x: number, y: number): Phaser.GameObjects.Graphics {
  const bar = scene.add.graphics();
  bar.fillStyle(color, 1);
  bar.fillRect(x, y, (value / maxValue) * 64, 5);
  return bar;
}

export function createActionMenu(
  scene: Phaser.Scene,
  character: Phaser.GameObjects.Sprite,
  onActionSelected: (action: string) => void
) {
  const menuWidth = 120;
  const menuHeight = 180;
  const menuBackground = scene.add.rectangle(0, 0, menuWidth, menuHeight, 0x333333).setOrigin(0);
  const textStyle = { fontSize: '16px', color: '#fff' };

  const moveText = scene.add.text(menuWidth / 2, 10, 'Move', textStyle).setOrigin(0.5);
  const attackText = scene.add.text(menuWidth / 2, 40, 'Attack', textStyle).setOrigin(0.5);
  const specialText = scene.add.text(menuWidth / 2, 70, 'Special', textStyle).setOrigin(0.5);
  const holdText = scene.add.text(menuWidth / 2, 100, 'Hold', textStyle).setOrigin(0.5);
  const cancelText = scene.add.text(menuWidth / 2, 130, 'Cancel', textStyle).setOrigin(0.5);

  const actionMenu = scene.add.container(character.x || 0, character.y || 0, [
    menuBackground,
    moveText,
    attackText,
    specialText,
    holdText,
    cancelText
  ]);

  moveText.setInteractive().on('pointerdown', () => onActionSelected('move'));
  attackText.setInteractive().on('pointerdown', () => onActionSelected('attack'));
  specialText.setInteractive().on('pointerdown', () => onActionSelected('special'));
  holdText.setInteractive().on('pointerdown', () => onActionSelected('hold'));
  cancelText.setInteractive().on('pointerdown', () => onActionSelected('cancel'));

  return actionMenu;
}
