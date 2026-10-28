import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app';
import { jsonLogger } from './log';
import { createModelChain, DEFAULT_MODELS, geminiCaller } from './model';

/** Production entry point: API plus the built, precompressed front end. */
const apiKey = process.env.GEMINI_API_KEY?.trim();
const models = (process.env.GEMINI_MODELS ?? '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

const model = apiKey
  ? createModelChain({
      models: models.length ? models : DEFAULT_MODELS,
      call: geminiCaller(apiKey),
      log: jsonLogger,
    })
  : null;
if (!model)
  jsonLogger('WARNING', 'GEMINI_API_KEY not set: AI features answer with built-in fallbacks');

const app = createApp({ model, log: jsonLogger });
const root = './dist/public';

app.use(
  '/assets/*',
  serveStatic({
    root,
    precompressed: true,
    onFound: (_path, c) => {
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);
app.use('*', serveStatic({ root, precompressed: true }));
app.get('*', serveStatic({ root, path: 'index.html', precompressed: true }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  jsonLogger('INFO', 'Tayyari listening', { port: info.port });
});
