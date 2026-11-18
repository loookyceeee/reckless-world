// Build step: copy RECKLESS CREW LOYALTY's crew_config.json (owner: loyalty; we only read it) into public/data.
// If the shared file is not on this machine (e.g. the Render build), the committed copy is kept.
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
const SRC = '/home/box/shared/reckless-crew/crew_config.json', DST = new URL('../public/data/crew_config.json', import.meta.url);
if (existsSync(SRC)) { const j = JSON.parse(readFileSync(SRC, 'utf8')); if (j.schema !== 'reckless-crew-config/v1') throw new Error('unexpected crew config schema ' + j.schema); copyFileSync(SRC, DST); console.log('crew_config synced', j.updated_at, j.status); }
else console.log('crew_config: shared copy not found, keeping bundled public/data/crew_config.json');
