import express from 'express';
import cors from 'cors';
import { timingSafeEqual } from 'node:crypto';
import { getFeed, getPreferences, getMatches, getBlockedProfiles, getProfiles, createAccount, blockProfile, unblockProfile, reportProfile, getPublicUser, undoLastSwipe, readState, writeState, resetState, profiles, demoUsers, hash } from './store.js';
import { createToken, requireAuth } from './auth.js';

const validCities = new Set(profiles.map(profile => profile.city));
const validInterests = new Set(profiles.flatMap(profile => profile.interests));

export function createApp() {
  const app = express();
  const api = express.Router();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '8kb' }));
  api.get('/health', (_req, res) => res.json({ status: 'ok' }));
  api.get('/auth/demo-accounts', (_req, res) => res.json({ accounts: demoUsers.map(getPublicUser) }));
  api.get('/auth/signup-options', (_req, res) => res.json({ cities: [...validCities].sort(), interests: [...validInterests].sort(), photos: demoUsers.map(({ id, name, email }) => { const profile = profiles.find(item => item.id === id); return { id, name, photo: profile.photo }; }) }));
  api.post('/auth/signup', async (req, res, next) => {
    try {
      const { name, email, password, age, city, bio, interests, photoId, discoveryCity = '', discoveryInterests = [] } = req.body ?? {};
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const cleanBio = typeof bio === 'string' ? bio.trim() : '';
      if (cleanName.length < 2 || cleanName.length > 50) return res.status(400).json({ error: 'Name must be between 2 and 50 characters.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      if (!Number.isInteger(age) || age < 18 || age > 99) return res.status(400).json({ error: 'Sign-up is for adults aged 18 to 99.' });
      if (typeof city !== 'string' || !validCities.has(city)) return res.status(400).json({ error: 'Choose a city from the available list.' });
      if (!cleanBio || cleanBio.length > 180) return res.status(400).json({ error: 'Bio must be between 1 and 180 characters.' });
      if (!Array.isArray(interests) || interests.length < 1 || interests.length > 5 || interests.some(item => !validInterests.has(item)) || new Set(interests).size !== interests.length) return res.status(400).json({ error: 'Choose 1 to 5 distinct profile interests.' });
      if (typeof photoId !== 'string' || !profiles.some(profile => profile.id === photoId)) return res.status(400).json({ error: 'Choose a profile photo from the available options.' });
      if (typeof discoveryCity !== 'string' || (discoveryCity && !validCities.has(discoveryCity))) return res.status(400).json({ error: 'Choose a valid discovery city or Any city.' });
      if (!Array.isArray(discoveryInterests) || discoveryInterests.length > 3 || discoveryInterests.some(item => !validInterests.has(item)) || new Set(discoveryInterests).size !== discoveryInterests.length) return res.status(400).json({ error: 'Choose up to three distinct discovery interests.' });
      const state = await readState();
      if (state.users.some(user => user.email.toLowerCase() === cleanEmail)) return res.status(409).json({ error: 'That email already has an account.' });
      const result = createAccount(state, { name: cleanName, email: cleanEmail, password, age, city, bio: cleanBio, interests, photoId, discoveryCity, discoveryInterests });
      await writeState(state);
      const user = getPublicUser(result.user, state);
      res.status(201).json({ token: createToken(user), user });
    } catch (e) { next(e); }
  });
  api.post('/auth/login', async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) return res.status(400).json({ error: 'Enter a demo ID or email and password.' });
      const identifier = email.trim().toLowerCase();
      const state = await readState(); const user = state.users?.find(u => u.email.toLowerCase() === identifier || u.id.toLowerCase() === identifier);
      const salt = user?.salt || 'invalid-user-salt'; const actual = Buffer.from(hash(password, salt), 'hex'); const expected = Buffer.from(user?.passwordHash || '00'.repeat(64), 'hex');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || !user) return res.status(401).json({ error: 'Email or password is incorrect.' });
      const publicUser = getPublicUser(user, state);
      res.json({ token: createToken(publicUser), user: publicUser });
    } catch (e) { next(e); }
  });
  api.get('/auth/me', requireAuth, async (req, res, next) => { try { const state = await readState(); const user = state.users?.find(u => u.id === req.user.sub); if (!user) return res.status(401).json({ error: 'Account no longer exists.' }); res.json({ user: getPublicUser(user, state) }); } catch (e) { next(e); } });
  api.post('/auth/logout', (_req, res) => res.json({ ok: true }));
  api.post('/reset', requireAuth, async (req, res, next) => { try { const state = await readState(); state.swipes = state.swipes.filter(s => s.userId !== req.user.sub); state.preferences = state.preferences.filter(p => p.userId !== req.user.sub); await writeState(state); res.json({ ok: true }); } catch (e) { next(e); } });
  api.get('/preferences', requireAuth, async (req, res, next) => { try { const state = await readState(); res.json({ preferences: getPreferences(state, req.user.sub), cities: [...validCities].sort(), interests: [...validInterests].sort() }); } catch (e) { next(e); } });
  api.put('/preferences', requireAuth, async (req, res, next) => {
    try {
      const { city = '', interests = [] } = req.body ?? {};
      if (typeof city !== 'string' || (city && !validCities.has(city))) return res.status(400).json({ error: 'Choose a city from the available list.' });
      if (!Array.isArray(interests) || interests.length > 3 || interests.some(interest => typeof interest !== 'string' || !validInterests.has(interest)) || new Set(interests).size !== interests.length) return res.status(400).json({ error: 'Choose up to three distinct interests from the available list.' });
      const state = await readState();
      const preferences = { userId: req.user.sub, city, interests };
      const index = state.preferences.findIndex(entry => entry.userId === req.user.sub);
      if (index < 0) state.preferences.push(preferences); else state.preferences[index] = preferences;
      await writeState(state); res.json({ preferences: { city, interests } });
    } catch (e) { next(e); }
  });
  api.get('/feed', requireAuth, async (req, res, next) => { try { const state = await readState(); res.json({ profiles: getFeed(state, req.user.sub) }); } catch (e) { next(e); } });
  api.get('/matches', requireAuth, async (req, res, next) => { try { const state = await readState(); res.json({ matches: getMatches(state, req.user.sub) }); } catch (e) { next(e); } });
  api.get('/safety/blocked', requireAuth, async (req, res, next) => {
    try { const state = await readState(); res.json({ profiles: getBlockedProfiles(state, req.user.sub) }); }
    catch (e) { next(e); }
  });
  api.post('/safety/block', requireAuth, async (req, res, next) => {
    try {
      const { profileId } = req.body ?? {};
      if (typeof profileId !== 'string' || !/^p\d{3}$/.test(profileId)) return res.status(400).json({ error: 'profileId must be a valid profile ID.' });
      const state = await readState();
      if (!getProfiles(state).some(profile => profile.id === profileId)) return res.status(404).json({ error: 'Profile not found.' });
      if (state.users.find(user => user.id === req.user.sub)?.profileId === profileId) return res.status(400).json({ error: 'You cannot block your own profile.' });
      const created = blockProfile(state, req.user.sub, profileId);
      if (created) await writeState(state);
      res.status(created ? 201 : 200).json({ blocked: true });
    } catch (e) { next(e); }
  });
  api.post('/safety/unblock', requireAuth, async (req, res, next) => {
    try {
      const { profileId } = req.body ?? {};
      if (typeof profileId !== 'string' || !/^p\d{3}$/.test(profileId)) return res.status(400).json({ error: 'profileId must be a valid profile ID.' });
      const state = await readState();
      if (!unblockProfile(state, req.user.sub, profileId)) return res.status(404).json({ error: 'That profile is not in your blocked list.' });
      await writeState(state); res.json({ blocked: false });
    } catch (e) { next(e); }
  });
  api.post('/safety/report', requireAuth, async (req, res, next) => {
    try {
      const { profileId, reason } = req.body ?? {};
      const allowedReasons = ['inappropriate_content', 'suspected_fake', 'harassment', 'other'];
      if (typeof profileId !== 'string' || !/^p\d{3}$/.test(profileId)) return res.status(400).json({ error: 'profileId must be a valid profile ID.' });
      if (!allowedReasons.includes(reason)) return res.status(400).json({ error: 'Choose one of the available report reasons.' });
      const state = await readState();
      if (!getProfiles(state).some(profile => profile.id === profileId)) return res.status(404).json({ error: 'Profile not found.' });
      if (state.users.find(user => user.id === req.user.sub)?.profileId === profileId) return res.status(400).json({ error: 'You cannot report your own profile.' });
      reportProfile(state, req.user.sub, profileId, reason);
      blockProfile(state, req.user.sub, profileId);
      await writeState(state);
      res.status(201).json({ reported: true, blocked: true });
    } catch (e) { next(e); }
  });
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
      const state = await readState();
      if (!getProfiles(state).some(p => p.id === profileId)) return res.status(404).json({ error: 'Profile not found.' });
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
      const profile = getProfiles(state).find(p => p.id === swipe.profileId);
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
