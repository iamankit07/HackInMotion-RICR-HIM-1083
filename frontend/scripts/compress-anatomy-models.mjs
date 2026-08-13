#!/usr/bin/env node
/**
 * Turns the source anatomy models into something a browser can actually load.
 *
 * The source models are VR-grade: around 500 MB across six files and roughly
 * 17.8 million triangles between them. Shipping those to a phone is not an
 * option, and GitHub refuses any single file over 100 MB, so the raw models
 * live outside this repository and only the compressed output is committed.
 *
 * Run it when the source models change:
 *
 *   node scripts/compress-anatomy-models.mjs --src "C:/path/to/Anatomy Body Models"
 *
 * The pipeline is deliberately weld -> simplify -> draco, run per model.
 * Do NOT replace it with `gltf-transform optimize`: that preset also runs
 * `join` and `flatten`, which merge separate organs into a handful of blobs
 * (83 nodes collapsed to 22 in testing) and destroy the per-part names the
 * viewer relies on to highlight one structure at a time.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const srcFlag = args.indexOf('--src');
const SRC = srcFlag !== -1 ? args[srcFlag + 1] : process.env.ANATOMY_SRC;
const OUT = resolve('public/models/anatomy');

// Keep 30% of triangles. Below roughly 0.2 the smaller structures — nerves and
// the finer vessels — start visibly breaking up.
const RATIO = '0.3';
const ERROR = '0.001';

if (!SRC || !existsSync(SRC)) {
  console.error(
    'Source models not found.\n' +
      'Pass --src "<folder with the .glb files>" or set ANATOMY_SRC.\n' +
      'The raw models are intentionally not in this repository (~500 MB).',
  );
  process.exit(1);
}

// Call the CLI's JS entry point through node rather than the `gltf-transform`
// shim. The shim is a .cmd on Windows, which recent Node refuses to spawn
// without a shell — and a shell would re-split the model paths on their spaces
// and hand the CLI four arguments instead of two.
const CLI = resolve('node_modules/@gltf-transform/cli/bin/cli.js');

if (!existsSync(CLI)) {
  console.error('@gltf-transform/cli is missing. Run `npm install` in frontend/ first.');
  process.exit(1);
}

const gltf = (cmdArgs) =>
  execFileSync(process.execPath, [CLI, ...cmdArgs], { stdio: ['ignore', 'pipe', 'pipe'] });

mkdirSync(OUT, { recursive: true });

const models = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.glb'));
if (!models.length) {
  console.error(`No .glb files in ${SRC}`);
  process.exit(1);
}

const mb = (p) => (statSync(p).size / 1048576).toFixed(2);
let totalBefore = 0;
let totalAfter = 0;

for (const file of models) {
  const input = join(SRC, file);
  const name = basename(file, '.glb');
  const tmpWeld = join(OUT, `${name}.weld.tmp.glb`);
  const tmpSimplify = join(OUT, `${name}.simplify.tmp.glb`);
  const output = join(OUT, `${name}.glb`);

  process.stdout.write(`${name.padEnd(22)} ${mb(input).padStart(8)} MB -> `);

  try {
    gltf(['weld', input, tmpWeld]);
    gltf(['simplify', tmpWeld, tmpSimplify, '--ratio', RATIO, '--error', ERROR]);
    gltf(['draco', tmpSimplify, output]);

    totalBefore += statSync(input).size;
    totalAfter += statSync(output).size;
    console.log(`${mb(output).padStart(6)} MB`);
  } finally {
    for (const tmp of [tmpWeld, tmpSimplify]) {
      if (existsSync(tmp)) rmSync(tmp);
    }
  }
}

console.log(
  `\nTotal ${(totalBefore / 1048576).toFixed(0)} MB -> ${(totalAfter / 1048576).toFixed(1)} MB ` +
    `(${(totalBefore / totalAfter).toFixed(1)}x smaller)`,
);
