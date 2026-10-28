// Bundles the Node server into one ESM file. Dependencies stay external and come from node_modules.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/main.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  logLevel: 'warning',
});
