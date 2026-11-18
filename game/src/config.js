// Tuning constants and the sun-soaked color language for Solana Bay.
// Every gameplay number and every HUD color lives here so the rest of the game
// stays small and each render module paints from the same bright palette.

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
  speed: 226,
  sprint: 342,
  health: 100,
  armor: 0,
  interactRange: 96,
  cash: 400,
};

export const WEAPONS = {
  pistol: { name: 'PISTOL', damage: 32, rate: 0.18, magazine: 14, reserve: 84, speed: 980, spread: 0.016, reload: 1.0 },
  smg: { name: 'SMG', damage: 18, rate: 0.08, magazine: 34, reserve: 204, speed: 1080, spread: 0.07, reload: 1.4 },
};

export const CAR_TYPES = [
  { name: 'SEDAN', maxSpeed: 340, accel: 250, turn: 2.4, hp: 115, length: 76, width: 40 },
  { name: 'COUPE', maxSpeed: 470, accel: 360, turn: 2.8, hp: 96, length: 80, width: 39 },
  { name: 'TRUCK', maxSpeed: 290, accel: 210, turn: 1.9, hp: 190, length: 94, width: 46 },
];

export const POLICE = {
  maxSpeed: 445,
  accel: 330,
  turn: 2.8,
  hp: 145,
  length: 84,
  width: 41,
  fireRate: 1.15,
  range: 560,
};

export const WANTED = {
  max: 5,
  cooldown: [14, 18, 23, 29, 36],
  radius: 700,
};

export const LIMITS = {
  traffic: 40,
  pedestrians: 70,
  bullets: 200,
  particles: 320,
  copCars: 6,
  pickups: 48,
};

export const CAR_COLORS = [
  '#ef5a58', '#f4a63c', '#2fc4b6', '#f4f1e4', '#7d74d8',
  '#3c9fe0', '#e8d9b0', '#79c65c', '#d76a9b', '#f27d52',
];

export const PALETTE = {
  backdrop: '#bde8f4',
  asphalt: '#d9d4c5',
  asphaltShade: '#c8c1ae',
  asphaltStripe: '#fff9e8',
  sidewalk: '#f2e5c9',
  curb: '#dcc59a',
  crosswalk: '#fffdf0',
  park: '#63b366',
  parkPath: '#e9d9aa',
  tree: '#2f8f50',
  treeLight: '#58bd63',
  palmTrunk: '#a97443',
  palmLeaf: '#3aa85a',
  water: '#29bdd7',
  waterDeep: '#1599bd',
  foam: '#eafbff',
  sand: '#f3dca1',
  sandDark: '#e3c480',
  building: ['#f6cba9', '#f7d9a1', '#f2aaa2', '#cbe0b8', '#bfdaee', '#e6c8e9', '#f2e3b9', '#d9c5ee', '#f8b9a5', '#dfe9c8'],
  roof: 'rgba(255,255,255,0.24)',
  roofLine: 'rgba(120,105,85,0.20)',
  window: '#5cbcdc',
  windowWarm: '#ffe8a8',
  player: '#ff5d4d',
  playerDark: '#bb3a34',
  cop: '#2457a6',
  copBlue: '#388fff',
  copRed: '#ff4f60',
  money: '#ffd23e',
  health: '#39cd78',
  armor: '#3da8f2',
  text: '#fffdf2',
  muted: '#e9e3cc',
  panel: 'rgba(16,30,44,0.92)',
  panelLight: 'rgba(24,44,60,0.82)',
  orange: '#ff9642',
  shadow: 'rgba(48,46,34,0.22)',
  ink: '#16232e',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const SAVE_KEY = 'solana-bay.progress.v1';
export const MUTE_KEY = 'solana-bay.mute.v1';
