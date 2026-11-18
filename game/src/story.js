import { RANKS } from './config.js';

export const CONTACTS = {
  Tito: { name: 'TITO ALVAREZ', tag: 'TITO', color: '#ffd45e', job: 'wheelman' },
  Dana: { name: 'DANA KESTREL', tag: 'DANA', color: '#4cc9f0', job: 'fixer' },
};

export const MISSIONS = [
  {
    title: 'CHECKPOINTS',
    contact: 'Tito',
    brief: [
      'Sunny, everybody wants the wheelman who can move.',
      'Take a car and run the five painted markers across Solana Bay.',
      'Stay off the sidewalk and keep it moving.',
    ],
    success: 'Clean run. Tito says you are the real thing.',
    reward: { money: 1200, reputation: 24 },
    objectives: [
      { type: 'goto', place: 'cp1', label: 'Reach checkpoint 1', radius: 100, needVehicle: true },
      { type: 'goto', place: 'cp2', label: 'Reach checkpoint 2', radius: 100, needVehicle: true },
      { type: 'goto', place: 'cp3', label: 'Reach checkpoint 3', radius: 100, needVehicle: true },
      { type: 'goto', place: 'cp4', label: 'Reach checkpoint 4', radius: 100, needVehicle: true },
      { type: 'goto', place: 'cp5', label: 'Reach checkpoint 5', radius: 100, needVehicle: true },
    ],
  },
  {
    title: 'HARBOR HANDOFF',
    contact: 'Dana',
    brief: [
      'A crate came in on the evening boat. Nobody saw it.',
      'Collect it at the harbor docks, then bring it to me.',
      'If the patrols get curious, do not stop.',
    ],
    success: 'Package delivered. Dana is smiling for once.',
    reward: { money: 1800, reputation: 32 },
    objectives: [
      { type: 'goto', place: 'harbor', label: 'Collect the package at the harbor', radius: 125, needVehicle: true },
      { type: 'goto', place: 'dana', label: 'Deliver the package to Dana', radius: 105, needVehicle: false },
    ],
  },
  {
    title: 'POLICE TAKEDOWN',
    contact: 'Tito',
    brief: [
      'They put a cruiser on your tail and called it a warning.',
      'Take down three officers, then regroup at the garage.',
      'Armor is in the trunk. Use it.',
    ],
    success: 'Three patrols down. The precinct will think twice.',
    reward: { money: 2400, reputation: 42 },
    objectives: [
      { type: 'takedown', kind: 'police', count: 3, label: 'Take down police officers (0/3)' },
      { type: 'goto', place: 'garage', label: 'Regroup at Sunny Garage', radius: 110, needVehicle: false },
    ],
  },
  {
    title: 'SHOPPING SPREE',
    contact: 'Dana',
    brief: [
      'The crew needs fresh threads before the big night.',
      'Hit Palm Boutique, Coast Outfitters and Bay Jewelers.',
      'Charge it to the house. Literally.',
    ],
    success: 'Three stops, no receipts. Dana calls it a masterpiece.',
    reward: { money: 3000, reputation: 48 },
    objectives: [
      { type: 'goto', place: 'shop1', label: 'Visit Palm Boutique', radius: 100, needVehicle: false },
      { type: 'goto', place: 'shop2', label: 'Visit Coast Outfitters', radius: 100, needVehicle: false },
      { type: 'goto', place: 'shop3', label: 'Visit Bay Jewelers', radius: 100, needVehicle: false },
    ],
  },
  {
    title: 'STREET RACE',
    contact: 'Tito',
    brief: [
      'Rico thinks he owns the night road. He does not.',
      'Follow the four race gates in order and leave him in the dust.',
      'A fast car helps. So does not crashing.',
    ],
    success: 'Rico eats dust. Tito is already planning the next run.',
    reward: { money: 3800, reputation: 58 },
    objectives: [
      { type: 'goto', place: 'race1', label: 'Pass race gate 1', radius: 105, needVehicle: true },
      { type: 'goto', place: 'race2', label: 'Pass race gate 2', radius: 105, needVehicle: true },
      { type: 'goto', place: 'race3', label: 'Pass race gate 3', radius: 105, needVehicle: true },
      { type: 'goto', place: 'race4', label: 'Pass race gate 4', radius: 105, needVehicle: true },
    ],
  },
  {
    title: 'FINAL SCORE',
    contact: 'Dana',
    brief: [
      'This is it. The villa, the crew, the whole bay.',
      'Get to the villa, take down four guards, then reach the escape boat.',
      'Come back in one piece, Sunny.',
    ],
    success: 'The score is yours. Solana Bay knows your name.',
    reward: { money: 6000, reputation: 90 },
    objectives: [
      { type: 'goto', place: 'villa', label: 'Reach the villa', radius: 125, needVehicle: true },
      { type: 'takedown', kind: 'guard', count: 4, label: 'Take down villa guards (0/4)' },
      { type: 'goto', place: 'escape', label: 'Reach the escape boat', radius: 130, needVehicle: true },
    ],
  },
];

export function rankForReputation(reputation) {
  let index = 0;
  for (let position = 0; position < RANKS.length; position += 1) {
    if (reputation >= RANKS[position].rep) index = position;
  }
  return index;
}

export function rankName(index) {
  return RANKS[Math.max(0, Math.min(RANKS.length - 1, index))].name;
}

export function nextRankReputation(reputation) {
  const index = rankForReputation(reputation);
  return index + 1 < RANKS.length ? RANKS[index + 1].rep : null;
}

export function missionForIndex(index) {
  return MISSIONS[Math.max(0, Math.min(MISSIONS.length - 1, index))];
}
