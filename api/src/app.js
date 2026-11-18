import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import v1 from './routes/v1.js';
import { errorHandler } from './middleware/errors.js';
import { config } from './config.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  // Keep the raw body so webhook signatures can be verified.
  app.use(express.json({ limit: '100kb', verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); } }));

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'wogen-api', provider: config.provider, env: config.env }));
  app.use('/v1', v1);
  app.use((_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}
