// The six-job story chain, the rank ladder and the small helpers that drive mission text.
// Every contact, job and reward here is original to SOLANA BAY.

export const RANKS = [
  { name: 'STREET ROOKIE', at: 0 },
  { name: 'SUN COAST RUNNER', at: 30 },
  { name: 'BAY ENFORCER', at: 70 },
  { name: 'HARBOR KING', at: 120 },
  { name: 'SOLANA LEGEND', at: 180 },
  { name: 'KING OF SOLANA BAY', at: 250 },
];

export const MISSIONS = [
  {
    title: 'CHECKPOINTS',
    contact: 'TITO ALVAREZ',
    brief: 'Sunny, Tito here. Take a set of wheels and hit three markers before the heat shows up. Keep it smooth.',
    objective: 'Drive through all 3 checkpoint markers',
    hint: 'Steal a parked car with E, then follow the gold rings.',
    reward: 900,
    reputation: 30,
    kind: 'checkpoints',
  },
  {
    title: 'HARBOR HANDOFF',
    contact: 'DANA KESTREL',
    brief: 'Dana. A crate came in on the evening boat. Pick it up at the harbor dock, then bring it to my market back room.',
    objective: 'Collect the crate, then deliver it to the market',
    hint: 'The dock is east of Palm Row. Press F at each marker.',
    reward: 1400,
    reputation: 40,
    kind: 'handoff',
  },
  {
    title: 'POLICE TAKEDOWN',
    contact: 'TITO ALVAREZ',
    brief: 'They crowded your mirror all last night. Take out three patrol cruisers and make the bay remember your name.',
    objective: 'Destroy 3 police cruisers',
    hint: 'Aim with the mouse and hold click or Space to fire.',
    reward: 2200,
    reputation: 50,
    kind: 'takedown',
  },
  {
    title: 'SHOPPING SPREE',
    contact: 'DANA KESTREL',
    brief: 'Three boutiques, one list, ninety-five seconds. On foot, Sunny. No wheels, no excuses.',
    objective: 'Visit all 3 boutiques before the timer runs out',
    hint: 'Leave the car and press F at each pink storefront marker.',
    reward: 2600,
    reputation: 60,
    kind: 'shopping',
  },
  {
    title: 'STREET RACE',
    contact: 'TITO ALVAREZ',
    brief: 'Rival crew is lining up on the South Strip. Four gates, one winner. Do not let them see your taillights.',
    objective: 'Pass all 4 race gates before the rival',
    hint: 'W throttle, A/D steer, Space handbrake through corners.',
    reward: 3800,
    reputation: 70,
    kind: 'race',
  },
  {
    title: 'FINAL SCORE',
    contact: 'DANA KESTREL',
    brief: 'Last run. Clear the villa of Tito\'s guards, then get to the escape boat. After that, the bay is yours.',
    objective: 'Clear 5 villa guards, then reach the escape boat',
    hint: 'Body armor helps. The boat waits at the harbor dock.',
    reward: 7500,
    reputation: 100,
    kind: 'final',
  },
];

/** The rank name for a reputation total. */
export function rankFor(reputation) {
  let name = RANKS[0].name;
  for (const rank of RANKS) if (reputation >= rank.at) name = rank.name;
  return name;
}

/** Progress toward the next rank, as a 0..1 number. */
export function rankFraction(reputation) {
  let current = RANKS[0];
  let next = RANKS[1];
  for (let index = 0; index < RANKS.length; index += 1) {
    if (reputation >= RANKS[index].at) {
      current = RANKS[index];
      next = RANKS[index + 1] ?? current;
    }
  }
  if (next === current) return 1;
  return Math.max(0, Math.min(1, (reputation - current.at) / (next.at - current.at)));
}

/** A fresh mission progress record for a newly started job. */
export function createMissionProgress() {
  return { stage: 0, progress: 0, timer: 0, failed: false, flash: 0, rivalProgress: 0, baseline: 0 };
}

/** The mission the player is currently working, or null after the final job. */
export function currentMission(index) {
  return MISSIONS[index] ?? null;
}

/** Format seconds as a compact mm:ss timer. */
export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
