// SOLANA BAY entrypoint. This only packages the static game: it copies game/ and screenshots/ into
// the output directory and writes dossier.json with the unchanged vendored make.fun library. The
// game itself is plain ES modules under game/, with no build step and no network requests.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(here, 'game');
const screenshotDir = join(here, 'screenshots');

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(screenshotDir)) cpSync(screenshotDir, join(out, 'screenshots'), { recursive: true });

// The scorer's caps: at most four screenshots, each under 256 KiB, and bounded game files.
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
