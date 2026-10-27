/**
 * Copy core/*.js to web/core/ and supabase/functions/_shared/core/ so the same engine runs
 * in the browser and in Deno edge functions. Creates folders as needed and overwrites.
 *
 * Usage: node scripts/sync-core.mjs
 */
import { readdirSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'core');
const targets = [join(root, 'web', 'core'), join(root, 'supabase', 'functions', '_shared', 'core')];

const files = readdirSync(src).filter((f) => f.endsWith('.js') && statSync(join(src, f)).isFile());
let copied = 0;
for (const target of targets) {
  mkdirSync(target, { recursive: true });
  for (const f of files) {
    copyFileSync(join(src, f), join(target, f));
    copied += 1;
  }
  process.stdout.write(`synced ${files.length} files -> ${target}\n`);
}
process.stdout.write(`done (${copied} copies)\n`);
