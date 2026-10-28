// Fails CI if the JavaScript a first visit downloads grows past the budget (gzipped).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 100;
const html = await readFile('dist/public/index.html', 'utf8');
const entry = [...html.matchAll(/src="\/assets\/([^"]+\.js)"/g)].map((match) => match[1]);
const preloads = [...html.matchAll(/href="\/assets\/([^"]+\.js)"/g)].map((match) => match[1]);
const initial = new Set([...entry, ...preloads]);
let initialBytes = 0;
let totalBytes = 0;
for (const name of await readdir('dist/public/assets')) {
  if (!name.endsWith('.js')) continue;
  const size = gzipSync(await readFile(join('dist/public/assets', name)), { level: 9 }).length;
  totalBytes += size;
  if (initial.has(name)) initialBytes += size;
}
const kb = (bytes) => (bytes / 1024).toFixed(1);
console.log(
  `first-load JS: ${kb(initialBytes)} kB gzipped (budget ${BUDGET_KB} kB); all JS: ${kb(totalBytes)} kB`,
);
if (initialBytes / 1024 > BUDGET_KB) {
  console.error('Bundle budget exceeded');
  process.exit(1);
}
