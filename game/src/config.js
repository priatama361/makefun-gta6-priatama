export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const WORLD = {
  width: 4200,
  height: 3100,
  pitch: 340,
  road: 66,
  coast: 240,
  beach: 400,
  ocean: 120,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 205,
  sprintSpeed: 320,
  maxHealth: 100,
  maxArmor: 100,
  respawnDelay: 2.5,
  interactRange: 74,
};

export const CAR = {
  length: 58,
  width: 30,
  engine: 760,
  reverse: 300,
  brake: 980,
  friction: 300,
  maxSpeed: 430,
  maxReverse: 150,
  steer: 2.7,
  grip: 4.5,
  collisionDamage: 7,
};

export const TRAFFIC = { count: 26, minSpeed: 90, maxSpeed: 165, pedestrianCount: 52 };

export const COMBAT = {
  bulletSpeed: 900,
  bulletLife: 1.15,
  playerDamage: 26,
  policeDamage: 9,
  fireDelay: 0.13,
  policeFireDelay: 1.3,
  range: 620,
  magazine: 12,
  reloadTime: 1.1,
  armorAbsorb: 0.65,
};

export const WANTED = {
  stars: 5,
  decayTime: 13,
  sightRange: 720,
  policePerStar: 1,
  starForShot: 0.055,
  starForHit: 1.2,
  starForCar: 0.8,
};

export const ECONOMY = {
  takedownCash: 140,
  pedestrianFine: -250,
  missionBonusTime: 400,
  healthPickup: 35,
  armorPickup: 40,
};

export const PALETTE = {
  sky: '#8ed8ef',
  ocean: '#2fb6c6',
  oceanDeep: '#1b8ba4',
  foam: '#e6fdff',
  sand: '#f2dda4',
  sandDark: '#e2c98d',
  ground: '#e9d9b6',
  groundAlt: '#dfcb9e',
  road: '#4b525b',
  roadEdge: '#626a73',
  roadLine: '#ffe4a1',
  asphalt: '#565e66',
  building: ['#f6c88a', '#ef9f86', '#f7df9c', '#d9b08c', '#e7a6a0', '#f3cf8b', '#bdd0b1', '#e8b784'],
  roof: ['#c98f63', '#c97b70', '#cfb46f', '#ab845f', '#bd7f7c', '#c9a05d', '#8fa583', '#bd8b60'],
  window: '#8fd3e8',
  awning: '#e6614e',
  palmTrunk: '#8b5a2b',
  palmLeaf: '#2f8f59',
  palmLeafLight: '#47ae6e',
  carColors: ['#f25f5c', '#ffd166', '#4cc9f0', '#8ac926', '#ff9f1c', '#ef476f', '#6a4c93', '#f8f4e6', '#3a86ff', '#e0a458'],
  police: '#20304a',
  panel: '#0e1e28',
  panelSoft: '#16303c',
  text: '#fff8e7',
  muted: '#bcd0d8',
  gold: '#ffd45e',
  accent: '#ff6b5e',
  health: '#4ddb8d',
  armor: '#5bb8ff',
  danger: '#ff5252',
  shadow: 'rgba(28, 38, 40, 0.24)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solana-bay.progress.v1';

export const RANKS = [
  { name: 'STREET ROOKIE', rep: 0 },
  { name: 'SUN COAST RUNNER', rep: 25 },
  { name: 'BAY ENFORCER', rep: 60 },
  { name: 'HARBOR KING', rep: 105 },
  { name: 'SOLANA LEGEND', rep: 165 },
  { name: 'KING OF SOLANA BAY', rep: 235 },
];

export const SHOT_SECONDS = { cover: 3, onfoot: 16, combat: 26, story: 9 };
