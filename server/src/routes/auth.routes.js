import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { createToken, requireAuth } from '../middleware/require-auth.js';
import {
  createAccount,
  demoUsers,
  getPublicUser,
  hash,
  profiles,
  readState,
  writeState,
} from '../services/state.service.js';

const router = Router();
const validCities = new Set(profiles.map(profile => profile.city));
const validInterests = new Set(profiles.flatMap(profile => profile.interests));

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.get('/auth/demo-accounts', (_req, res) => {
  res.json({ accounts: demoUsers.map(getPublicUser) });
});

router.get('/auth/signup-options', (_req, res) => {
  const photos = demoUsers.map(({ id, name }) => ({
    id,
    name,
    photo: profiles.find(profile => profile.id === id).photo,
  }));

  res.json({
    cities: [...validCities].sort(),
    interests: [...validInterests].sort(),
    photos,
  });
});

router.post('/auth/signup', async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      age,
      city,
      bio,
      interests,
      photoId,
      discoveryCity = '',
      discoveryInterests = [],
    } = req.body ?? {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanBio = typeof bio === 'string' ? bio.trim() : '';

    if (cleanName.length < 2 || cleanName.length > 50) {
      return res.status(400).json({ error: 'Name must be between 2 and 50 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }
    if (!Number.isInteger(age) || age < 18 || age > 99) {
      return res.status(400).json({ error: 'Sign-up is for adults aged 18 to 99.' });
    }
    if (typeof city !== 'string' || !validCities.has(city)) {
      return res.status(400).json({ error: 'Choose a city from the available list.' });
    }
    if (!cleanBio || cleanBio.length > 180) {
      return res.status(400).json({ error: 'Bio must be between 1 and 180 characters.' });
    }
    if (
      !Array.isArray(interests) ||
      interests.length < 1 ||
      interests.length > 5 ||
      interests.some(item => !validInterests.has(item)) ||
      new Set(interests).size !== interests.length
    ) {
      return res.status(400).json({ error: 'Choose 1 to 5 distinct profile interests.' });
    }
    if (typeof photoId !== 'string' || !profiles.some(profile => profile.id === photoId)) {
      return res.status(400).json({ error: 'Choose a profile photo from the available options.' });
    }
    if (typeof discoveryCity !== 'string' || (discoveryCity && !validCities.has(discoveryCity))) {
      return res.status(400).json({ error: 'Choose a valid discovery city or Any city.' });
    }
    if (
      !Array.isArray(discoveryInterests) ||
      discoveryInterests.length > 3 ||
      discoveryInterests.some(item => !validInterests.has(item)) ||
      new Set(discoveryInterests).size !== discoveryInterests.length
    ) {
      return res.status(400).json({ error: 'Choose up to three distinct discovery interests.' });
    }

    const state = await readState();
    if (state.users.some(user => user.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: 'That email already has an account.' });
    }

    const { user } = createAccount(state, {
      name: cleanName,
      email: cleanEmail,
      password,
      age,
      city,
      bio: cleanBio,
      interests,
      photoId,
      discoveryCity,
      discoveryInterests,
    });
    await writeState(state);

    const publicUser = getPublicUser(user, state);
    res.status(201).json({ token: createToken(publicUser), user: publicUser });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) {
      return res.status(400).json({ error: 'Enter a demo ID or email and password.' });
    }

    const identifier = email.trim().toLowerCase();
    const state = await readState();
    const user = state.users.find(account =>
      account.email.toLowerCase() === identifier || account.id.toLowerCase() === identifier,
    );
    const salt = user?.salt || 'invalid-user-salt';
    const actual = Buffer.from(hash(password, salt), 'hex');
    const expected = Buffer.from(user?.passwordHash || '00'.repeat(64), 'hex');

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || !user) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const publicUser = getPublicUser(user, state);
    res.json({ token: createToken(publicUser), user: publicUser });
  } catch (error) {
    next(error);
  }
});

router.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    const state = await readState();
    const user = state.users.find(account => account.id === req.user.sub);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    res.json({ user: getPublicUser(user, state) });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/logout', (_req, res) => res.json({ ok: true }));

export default router;
