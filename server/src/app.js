import express from 'express';
import cors from 'cors';
import { timingSafeEqual } from 'node:crypto';
import { getFeed, getMatches, getPublicUser, undoLastSwipe, readState, writeState, resetState, profiles, demoUsers, hash } from './store.js';
import { createToken, requireAuth } from './auth.js';

export function createApp() {
  const app = express();
  const api = express.Router();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '8kb' }));
  api.get('/health', (_req, res) => res.json({ status: 'ok' }));
  api.get('/auth/demo-accounts', (_req, res) => res.json({ accounts: demoUsers.map(getPublicUser) }));
  api.post('/auth/login', async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) return res.status(400).json({ error: 'Enter a demo ID or email and password.' });
      const identifier = email.trim().toLowerCase();
      const state = await readState(); const user = state.users?.find(u => u.email.toLowerCase() === identifier || u.id.toLowerCase() === identifier);
      const salt = user?.salt || 'invalid-user-salt'; const actual = Buffer.from(hash(password, salt), 'hex'); const expected = Buffer.from(user?.passwordHash || '00'.repeat(64), 'hex');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || !user) return res.status(401).json({ error: 'Email or password is incorrect.' });
      const publicUser = getPublicUser(user);
      res.json({ token: createToken(publicUser), user: publicUser });
    } catch (e) { next(e); }
  });
  api.get('/auth/me', requireAuth, async (req, res, next) => { try { const state = await readState(); const user = state.users?.find(u => u.id === req.user.sub); if (!user) return res.status(401).json({ error: 'Account no longer exists.' }); res.json({ user: getPublicUser(user) }); } catch (e) { next(e); } });
  api.post('/auth/logout', (_req, res) => res.json({ ok: true }));
  api.post('/reset', requireAuth, async (req, res, next) => { try { const state = await readState(); state.swipes = state.swipes.filter(s => s.userId !== req.user.sub); await writeState(state); res.json({ ok: true }); } catch (e) { next(e); } });
  api.get('/feed', requireAuth, async (req, res, next) => { try { const state = await readState(); res.json({ profiles: getFeed(state, req.user.sub) }); } catch (e) { next(e); } });
  api.get('/matches', requireAuth, async (req, res, next) => { try { const state = await readState(); res.json({ matches: getMatches(state, req.user.sub) }); } catch (e) { next(e); } });
  api.get('/swipe/last', requireAuth, async (req, res, next) => {
    try {
      const state = await readState(); const swipe = [...state.swipes].reverse().find(s => s.userId === req.user.sub);
      res.json({ canUndo: Boolean(swipe) });
    } catch (e) { next(e); }
  });
  api.post('/swipe', requireAuth, async (req, res, next) => {
    try {
      const { profileId, direction } = req.body ?? {};
      if (typeof profileId !== 'string' || !/^p\d{3}$/.test(profileId)) return res.status(400).json({ error: 'profileId must be a valid profile ID.' });
      if (!['like', 'pass'].includes(direction)) return res.status(400).json({ error: 'direction must be "like" or "pass".' });
      if (!profiles.some(p => p.id === profileId)) return res.status(404).json({ error: 'Profile not found.' });
      const state = await readState();
      if (state.users?.find(user => user.id === req.user.sub)?.profileId === profileId) return res.status(400).json({ error: 'You cannot swipe on your own profile.' });
      if (state.swipes.some(s => s.userId === req.user.sub && s.profileId === profileId)) return res.status(409).json({ error: 'This profile has already been swiped.' });
      state.swipes.push({ userId: req.user.sub, profileId, direction, createdAt: new Date().toISOString() });
      await writeState(state);
      const ownProfileId = state.users?.find(user => user.id === req.user.sub)?.profileId;
      const matched = direction === 'like' && profileId !== ownProfileId && profiles.find(p => p.id === profileId)?.likedYou === true;
      res.status(201).json({ swipe: { profileId, direction }, matched, match: matched ? getMatches(state, req.user.sub).find(p => p.id === profileId) : null });
    } catch (e) { next(e); }
  });
  api.post('/swipe/undo', requireAuth, async (req, res, next) => {
    try {
      const state = await readState(); const swipe = undoLastSwipe(state, req.user.sub);
      if (!swipe) return res.status(404).json({ error: 'There is no swipe to undo yet.' });
      await writeState(state);
      const profile = profiles.find(p => p.id === swipe.profileId);
      if (!profile) return res.status(500).json({ error: 'The profile for that swipe is unavailable.' });
      const { likedYou, ...publicProfile } = profile;
      res.json({ swipe: { profileId: swipe.profileId, direction: swipe.direction }, profile: publicProfile });
    } catch (e) { next(e); }
  });
  api.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
  api.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Something went wrong while loading your demo data.' }); });
  app.use('/api', api);
  app.use(api);
  return app;
}
