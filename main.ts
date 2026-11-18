// Solana Bay v2 entry (Node 22, standard library only). The playable game is
// this directory's game/ folder: plain static files a desktop browser opens
// offline (game/index.html and local ES modules, no build and no network call),
// and this program hands it in. It copies game/ and screenshots/ beside itself
// to the output directory, then writes dossier.json with the vendored make.fun
// library. The game is a sun-soaked open-world crime story: walk or drive a
// procedurally generated coastal city, take an ordered chain of story jobs,
// fight and evade police, earn money and reputation, rank up and keep progress
// in localStorage. The four captures show real staged gameplay states.
//
// Serve locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the dossier; the others
// refuse an entry the scorer would refuse. Keep these in sync with its gate.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
