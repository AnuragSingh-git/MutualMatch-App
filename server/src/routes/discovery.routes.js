import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import {
  getFeed,
  getMatches,
  getPreferences,
  getProfiles,
  profiles,
  readState,
  undoLastSwipe,
  writeState,
} from '../services/state.service.js';

const router = Router();
const validCities = new Set(profiles.map(profile => profile.city));
const validInterests = new Set(profiles.flatMap(profile => profile.interests));

router.get('/feed', requireAuth, async (req, res, next) => {
  try {
    const state = await readState();
    res.json({ profiles: getFeed(state, req.user.sub) });
  } catch (error) {
    next(error);
  }
});

router.get('/matches', requireAuth, async (req, res, next) => {
  try {
    const state = await readState();
    res.json({ matches: getMatches(state, req.user.sub) });
  } catch (error) {
    next(error);
  }
});

router.get('/preferences', requireAuth, async (req, res, next) => {
  try {
    const state = await readState();
    res.json({
      preferences: getPreferences(state, req.user.sub),
      cities: [...validCities].sort(),
      interests: [...validInterests].sort(),
    });
  } catch (error) {
    next(error);
  }
});

router.put('/preferences', requireAuth, async (req, res, next) => {
  try {
    const { city = '', interests = [] } = req.body ?? {};
    if (typeof city !== 'string' || (city && !validCities.has(city))) {
      return res.status(400).json({ error: 'Choose a city from the available list.' });
    }
    if (
      !Array.isArray(interests) ||
      interests.length > 3 ||
      interests.some(interest => typeof interest !== 'string' || !validInterests.has(interest)) ||
      new Set(interests).size !== interests.length
    ) {
      return res.status(400).json({ error: 'Choose up to three distinct interests from the available list.' });
    }

    const state = await readState();
    const preferences = { userId: req.user.sub, city, interests };
    const index = state.preferences.findIndex(entry => entry.userId === req.user.sub);
    if (index < 0) state.preferences.push(preferences);
    else state.preferences[index] = preferences;

    await writeState(state);
    res.json({ preferences: { city, interests } });
  } catch (error) {
    next(error);
  }
});

router.post('/reset', requireAuth, async (req, res, next) => {
  try {
    const state = await readState();
    state.swipes = state.swipes.filter(swipe => swipe.userId !== req.user.sub);
    state.preferences = state.preferences.filter(entry => entry.userId !== req.user.sub);
    await writeState(state);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/swipe/last', requireAuth, async (req, res, next) => {
  try {
    const state = await readState();
    const swipe = [...state.swipes].reverse().find(item => item.userId === req.user.sub);
    res.json({ canUndo: Boolean(swipe) });
  } catch (error) {
    next(error);
  }
});

router.post('/swipe', requireAuth, async (req, res, next) => {
  try {
    const { profileId, direction } = req.body ?? {};
    if (typeof profileId !== 'string' || !/^p\d{3}$/.test(profileId)) {
      return res.status(400).json({ error: 'profileId must be a valid profile ID.' });
    }
    if (!['like', 'pass'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be "like" or "pass".' });
    }

    const state = await readState();
    if (!getProfiles(state).some(profile => profile.id === profileId)) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    if (state.users.find(user => user.id === req.user.sub)?.profileId === profileId) {
      return res.status(400).json({ error: 'You cannot swipe on your own profile.' });
    }
    if (state.blocks.some(block => block.userId === req.user.sub && block.profileId === profileId)) {
      return res.status(409).json({ error: 'Unblock this profile before swiping on it.' });
    }
    if (state.swipes.some(swipe => swipe.userId === req.user.sub && swipe.profileId === profileId)) {
      return res.status(409).json({ error: 'This profile has already been swiped.' });
    }

    state.swipes.push({ userId: req.user.sub, profileId, direction, createdAt: new Date().toISOString() });
    await writeState(state);

    const ownProfileId = state.users.find(user => user.id === req.user.sub)?.profileId;
    const target = getProfiles(state).find(profile => profile.id === profileId);
    const matched = direction === 'like' && profileId !== ownProfileId && target?.likedYou === true;
    const match = matched ? getMatches(state, req.user.sub).find(profile => profile.id === profileId) : null;

    res.status(201).json({ swipe: { profileId, direction }, matched, match });
  } catch (error) {
    next(error);
  }
});

router.post('/swipe/undo', requireAuth, async (req, res, next) => {
  try {
    const state = await readState();
    const swipe = undoLastSwipe(state, req.user.sub);
    if (!swipe) return res.status(404).json({ error: 'There is no swipe to undo yet.' });

    await writeState(state);
    const profile = getProfiles(state).find(item => item.id === swipe.profileId);
    if (!profile) return res.status(500).json({ error: 'The profile for that swipe is unavailable.' });
    const { likedYou, ...publicProfile } = profile;
    res.json({ swipe: { profileId: swipe.profileId, direction: swipe.direction }, profile: publicProfile });
  } catch (error) {
    next(error);
  }
});

export default router;
