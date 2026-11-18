export const FIELD = { width: 1280, height: 720 };

export const STEP = 1 / 60;

export const CITY = {
  cell: 320,
  road: 108,
  cols: 15,
  rows: 12,
  beachCol: 12,
};

export const CITY_WIDTH = CITY.cols * CITY.cell;
export const CITY_HEIGHT = CITY.rows * CITY.cell;

export const PLAYER = {
  radius: 14,
  speed: 216,
  sprint: 330,
  health: 100,
  armor: 0,
  interactRange: 84,
  cash: 250,
};

export const WEAPONS = {
  pistol: { name: 'PISTOL', damage: 30, rate: 0.2, magazine: 12, reserve: 72, speed: 940, spread: 0.018, reload: 1.1 },
  smg: { name: 'SMG', damage: 17, rate: 0.085, magazine: 30, reserve: 180, speed: 1020, spread: 0.075, reload: 1.5 },
};

export const CAR_TYPES = [
  { name: 'SEDAN', maxSpeed: 330, accel: 245, turn: 2.35, hp: 110, length: 74, width: 38 },
  { name: 'COUPE', maxSpeed: 455, accel: 350, turn: 2.75, hp: 92, length: 78, width: 38 },
  { name: 'TRUCK', maxSpeed: 285, accel: 205, turn: 1.9, hp: 170, length: 92, width: 44 },
];

export const POLICE = {
  maxSpeed: 400,
  accel: 300,
  turn: 2.6,
  hp: 130,
  length: 82,
  width: 40,
  fireRate: 1.25,
  range: 520,
};

export const WANTED = {
  max: 5,
  cooldown: [13, 17, 22, 27, 33],
  radius: 660,
};

export const MISSION = {
  robberyHold: 1.6,
  deliveryTime: 42,
  raceTime: 36,
  rewards: [900, 1400, 2000, 2800, 3800, 5000],
};

export const LIMITS = {
  traffic: 34,
  pedestrians: 62,
  bullets: 180,
  particles: 260,
  copCars: 6,
  pickups: 40,
};

export const PALETTE = {
  backdrop: '#0b0e15',
  asphalt: '#212734',
  asphaltLight: '#28303e',
  sidewalk: '#465063',
  curb: '#68748b',
  paint: '#c8d2e0',
  crosswalk: '#9aa6b9',
  park: '#315e4a',
  parkDark: '#244937',
  tree: '#3f7d58',
  treeLight: '#5a9b6c',
  water: '#16445f',
  waterLight: '#236681',
  sand: '#d6bb80',
  building: ['#4a5468', '#586078', '#3e475b', '#646c84', '#414b60', '#525d72', '#6a7289', '#454f65'],
  roof: '#2b3242',
  window: '#ffd88a',
  windowDark: '#7d8aa1',
  player: '#30e0d0',
  playerDark: '#147f7a',
  cop: '#2a3d63',
  copBlue: '#4a9bff',
  copRed: '#ff4d6d',
  money: '#ffd257',
  health: '#5ee08a',
  armor: '#69a9ff',
  text: '#f3f6fc',
  muted: '#9faabf',
  panel: 'rgba(12, 16, 26, 0.9)',
  orange: '#ff9f45',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const BEST_KEY = 'neon-shores.best';
export const MUTE_KEY = 'neon-shores.mute';
