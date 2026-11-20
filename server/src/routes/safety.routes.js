import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import {
  blockProfile,
  getBlockedProfiles,
  getProfiles,
  readState,
  reportProfile,
  unblockProfile,
  writeState,
} from '../services/state.service.js';

const router = Router();
const reportReasons = new Set(['inappropriate_content', 'suspected_fake', 'harassment', 'other']);

router.get('/safety/blocked', requireAuth, async (req, res, next) => {
  try {
    const state = await readState();
    res.json({ profiles: getBlockedProfiles(state, req.user.sub) });
  } catch (error) {
    next(error);
  }
});

router.post('/safety/block', requireAuth, async (req, res, next) => {
  try {
    const { profileId } = req.body ?? {};
    if (typeof profileId !== 'string' || !/^p\d{3}$/.test(profileId)) {
      return res.status(400).json({ error: 'profileId must be a valid profile ID.' });
    }

    const state = await readState();
    if (!getProfiles(state).some(profile => profile.id === profileId)) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    if (state.users.find(user => user.id === req.user.sub)?.profileId === profileId) {
      return res.status(400).json({ error: 'You cannot block your own profile.' });
    }

    const created = blockProfile(state, req.user.sub, profileId);
    if (created) await writeState(state);
    res.status(created ? 201 : 200).json({ blocked: true });
  } catch (error) {
    next(error);
  }
});

router.post('/safety/unblock', requireAuth, async (req, res, next) => {
  try {
    const { profileId } = req.body ?? {};
    if (typeof profileId !== 'string' || !/^p\d{3}$/.test(profileId)) {
      return res.status(400).json({ error: 'profileId must be a valid profile ID.' });
    }

    const state = await readState();
    if (!unblockProfile(state, req.user.sub, profileId)) {
      return res.status(404).json({ error: 'That profile is not in your blocked list.' });
    }
    await writeState(state);
    res.json({ blocked: false });
  } catch (error) {
    next(error);
  }
});

router.post('/safety/report', requireAuth, async (req, res, next) => {
  try {
    const { profileId, reason } = req.body ?? {};
    if (typeof profileId !== 'string' || !/^p\d{3}$/.test(profileId)) {
      return res.status(400).json({ error: 'profileId must be a valid profile ID.' });
    }
    if (!reportReasons.has(reason)) {
      return res.status(400).json({ error: 'Choose one of the available report reasons.' });
    }

    const state = await readState();
    if (!getProfiles(state).some(profile => profile.id === profileId)) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    if (state.users.find(user => user.id === req.user.sub)?.profileId === profileId) {
      return res.status(400).json({ error: 'You cannot report your own profile.' });
    }

    reportProfile(state, req.user.sub, profileId, reason);
    blockProfile(state, req.user.sub, profileId);
    await writeState(state);
    res.status(201).json({ reported: true, blocked: true });
  } catch (error) {
    next(error);
  }
});

export default router;
