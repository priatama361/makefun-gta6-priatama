// Original cast and ordered story chain for Solana Bay. The world runs these
// mission definitions as small step machines; nothing here knows about drawing.

export const PROTAGONIST = {
  name: 'MARA "SUNNY" VEGA',
  short: 'SUNNY',
  role: 'getaway driver turned city fixer',
  tagline: 'Back on the Sun Coast with a lead foot and one last debt to settle.',
};

export const CONTACTS = {
  tito: { name: 'TITO ALVAREZ', role: 'Garage owner', color: '#ffd23e', short: 'TITO' },
  dana: { name: 'DANA KESTREL', role: 'Harbor dispatcher', color: '#5ce0d0', short: 'DANA' },
  vivian: { name: 'VIVIAN CROSS', role: 'Land developer', color: '#ff96c6', short: 'VIVIAN' },
};

export const MISSIONS = [
  {
    id: 'first-gear',
    title: 'FIRST GEAR',
    contact: 'tito',
    brief: 'Sunny, the garage is still yours. Collect a ride and roll into the plaza.',
    reward: 900,
    rep: 120,
    steps: [
      { kind: 'travel', spot: 'garage', mode: 'foot', label: 'MEET TITO AT THE GARAGE' },
      { kind: 'steal', label: 'TAKE ANY SET OF WHEELS' },
      { kind: 'travel', spot: 'plaza', mode: 'car', label: 'PARK AT THE SUN PLAZA' },
    ],
  },
  {
    id: 'sunset-run',
    title: 'SUNSET RUN',
    contact: 'tito',
    brief: 'Three markers, one warm afternoon. Do not scratch the paint.',
    reward: 1600,
    rep: 180,
    steps: [
      { kind: 'steal', label: 'GRAB A FAST CAR' },
      { kind: 'checkpoints', count: 3, label: 'CHECKPOINT 1 / 3' },
    ],
  },
  {
    id: 'harbor-handoff',
    title: 'HARBOR HANDOFF',
    contact: 'dana',
    brief: 'A crate came in on the evening boat. Pick it up by the pier, then move it across town before the sun drops.',
    reward: 2400,
    rep: 240,
    unlock: 'smg',
    steps: [
      { kind: 'travel', spot: 'harbor', mode: 'foot', label: 'REACH THE HARBOR' },
      { kind: 'pickup', spot: 'pier', label: 'COLLECT THE CRATE  [E]' },
      { kind: 'deliver', spot: 'plaza', mode: 'car', label: 'DELIVER TO THE PLAZA' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'HEAT WAVE',
    contact: 'dana',
    brief: 'The crate was watched. Lose the blue lights and get back to the safehouse.',
    reward: 3400,
    rep: 300,
    wanted: 2,
    steps: [
      { kind: 'escape', spot: 'safehouse', label: 'LOSE THE COPS, REACH THE SAFEHOUSE' },
    ],
  },
  {
    id: 'cross-town-block',
    title: 'CROSS-TOWN BLOCK',
    contact: 'dana',
    brief: 'They sent the whole precinct. Lighten their numbers before they lighten yours.',
    reward: 4600,
    rep: 360,
    wanted: 2,
    steps: [
      { kind: 'eliminate', count: 3, label: 'TAKE DOWN 3 POLICE CARS  0 / 3' },
    ],
  },
  {
    id: 'golden-deal',
    title: 'THE GOLDEN DEAL',
    contact: 'vivian',
    brief: 'Cross wants the boardwalk clean. Meet her, take the pier, then disappear.',
    reward: 9000,
    rep: 600,
    wanted: 3,
    steps: [
      { kind: 'travel', spot: 'boardwalk', mode: 'foot', label: 'MEET VIVIAN ON THE BOARDWALK' },
      { kind: 'travel', spot: 'pier', mode: 'foot', label: 'TAKE THE PIER' },
      { kind: 'escape', spot: 'safehouse', wanted: 3, label: 'VANISH BEFORE THE SIRENS ARRIVE' },
    ],
  },
];

export const RANKS = [
  { min: 0, name: 'STREET ROOKIE' },
  { min: 300, name: 'LOCAL DRIVER' },
  { min: 800, name: 'WHEELMAN' },
  { min: 1500, name: 'STREET LEGEND' },
  { min: 2600, name: 'SUNSET ICON' },
  { min: 4000, name: 'KING OF SOLANA BAY' },
];

export function rankFor(rep) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) if (rep >= RANKS[i].min) index = i;
  const current = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const span = next ? next.min - current.min : 1;
  return {
    name: current.name,
    index,
    next: next ? next.name : 'MAX RANK',
    progress: next ? Math.max(0, Math.min(1, (rep - current.min) / span)) : 1,
  };
}

export function missionAt(index) {
  return MISSIONS[Math.max(0, Math.min(MISSIONS.length - 1, index))];
}

export function contactOf(mission) {
  return CONTACTS[mission.contact];
}
