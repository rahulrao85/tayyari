// Writes .br and .gz copies of every text asset so the server never compresses on the fly.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ROOT = 'dist/public';
const TEXT = /\.(js|css|html|svg|txt|json)$/;

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (TEXT.test(entry.name)) yield path;
  }
}

let count = 0;
for await (const path of files(ROOT)) {
  const body = await readFile(path);
  await writeFile(
    `${path}.br`,
    brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
  );
  await writeFile(`${path}.gz`, gzipSync(body, { level: 9 }));
  count += 1;
}
console.log(`precompressed ${count} files`);
