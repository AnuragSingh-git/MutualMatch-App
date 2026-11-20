import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import discoveryRoutes from './routes/discovery.routes.js';
import safetyRoutes from './routes/safety.routes.js';

const apiRoutes = [authRoutes, discoveryRoutes, safetyRoutes];

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '8kb' }));

  // Keep the assessment's root paths and the namespaced paths available.
  apiRoutes.forEach(route => app.use('/api', route));
  apiRoutes.forEach(route => app.use(route));

  app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong while loading your demo data.' });
  });

  return app;
}
