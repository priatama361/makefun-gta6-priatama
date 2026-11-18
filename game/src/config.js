// SOLANA BAY - central tuning values. The playfield is a fixed 1280x720 logical area; the
// renderer scales it to any window. All world sizes are in the same logical pixels.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

// The city is a grid of roads on a sunlit peninsula. The sea starts at shoreX.
export const WORLD = {
  width: 3400,
  height: 2200,
  shoreX: 2520,
  roadWidth: 132,
  verticalRoads: [250, 750, 1250, 1750, 2250],
  horizontalRoads: [250, 700, 1150, 1600, 2050],
};

export const PLAYER = {
  walkSpeed: 205,
  sprintSpeed: 320,
  radius: 15,
  maxHealth: 100,
  maxArmor: 100,
  fireDelay: 0.14,
  bulletSpeed: 1050,
  bulletDamage: 27,
  interactRange: 92,
};

export const CAR = {
  length: 76,
  width: 38,
  accel: 340,
  brake: 520,
  reverse: 170,
  friction: 0.62,
  steer: 2.5,
  trafficSpeed: 105,
  policeSpeed: 295,
  rivalSpeed: 330,
  maxHealth: 100,
};

export const POLICE = {
  wantedPerStar: 100,
  decayDelay: 16,
  officerSpeed: 155,
  officerHealth: 60,
  spawnDelay: 4.5,
  maxCars: 8,
  maxOfficers: 10,
  sight: 700,
  range: 480,
};

export const MISSION = {
  interactRange: 100,
  checkpointRadius: 86,
  raceRetry: 3,
  shoppingSeconds: 95,
};

// Warm daylight: sea blue, sand, cream stone, hot pink and sunset gold.
export const PALETTE = {
  sea: '#1ba9c9',
  seaDeep: '#087ea6',
  seaFoam: '#bff4f4',
  sand: '#f4d9a4',
  sandDark: '#dfbd83',
  land: '#f6e7c6',
  road: '#5c6672',
  roadLight: '#6d7884',
  sidewalk: '#d8c9a9',
  lane: '#ffe6a8',
  shadow: 'rgba(63,43,34,0.28)',
  building: ['#f7b58b', '#f4cf94', '#ef9e86', '#f9ddb0', '#e9ad9b', '#f6c587'],
  roof: ['#d98467', '#d9b16c', '#cf7d6d', '#e2bb7f', '#c88875', '#e0a96d'],
  park: '#8fbf6a',
  palm: '#2f8c5b',
  palmDark: '#1f6546',
  trunk: '#9c6b42',
  player: '#ffd23f',
  playerDark: '#d94f3d',
  police: '#243b63',
  policeBlue: '#2f7ff0',
  policeRed: '#ff4f5e',
  bullet: '#fff3b0',
  hudPanel: 'rgba(24,32,48,0.86)',
  hudPanelLight: 'rgba(31,42,61,0.78)',
  hudLine: 'rgba(255,231,176,0.35)',
  text: '#fffaf0',
  muted: '#c9d4e2',
  gold: '#ffd23f',
  green: '#69df9a',
  red: '#ff6b6b',
  cyan: '#7de8ff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solana-bay.save.v3';
