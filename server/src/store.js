import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { profiles } from './data/profiles.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, process.env.DATA_FILE || '../data/state.json');
let mongoClientPromise;
async function mongoCollection() {
  if (!process.env.MONGODB_URI) return null;
  if (!mongoClientPromise) mongoClientPromise = (async () => {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    return client.db(process.env.MONGODB_DB || 'coy_discover').collection(process.env.MONGODB_COLLECTION || 'app_state');
  })();
  return mongoClientPromise;
}
const demoUsers = profiles.slice(0, 10).map(profile => ({
  id: profile.id, profileId: profile.id, name: profile.name,
  email: `${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}@example.com`,
  password: 'CoyDemo123!'
}));
const hash = (password, salt) => scryptSync(password, salt, 64).toString('hex');
const initial = () => ({ version: 3, users: demoUsers.map(u => { const salt = randomBytes(16).toString('hex'); return { id: u.id, profileId: u.profileId, name: u.name, email: u.email, salt, passwordHash: hash(u.password, salt) }; }), swipes: [], blocks: [], reports: [], preferences: [] });
let initialization;

export async function readState() {
  const collection = await mongoCollection();
  if (collection) {
    let document = await collection.findOne({ _id: 'main' });
    if (!document) {
      const state = initial();
      try { await collection.insertOne({ _id: 'main', state }); document = { state }; }
      catch (error) { if (error.code !== 11000) throw error; document = await collection.findOne({ _id: 'main' }); }
    }
    return ensureDemoAccounts(document.state);
  }
  try {
    const raw = await fs.readFile(file, 'utf8'); const state = JSON.parse(raw);
    if (!Array.isArray(state.swipes)) throw new Error('Invalid state');
    return ensureDemoAccounts(state);
  }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Could not read saved app data. Run npm run reset to restore the demo.', { cause: error });
    if (!initialization) initialization = (async () => { const state = initial(); await writeState(state); return state; })().finally(() => { initialization = undefined; });
    return initialization;
  }
}
async function ensureDemoAccounts(state) {
  let safetyMigration = false;
  if (!Array.isArray(state.blocks)) { state.blocks = []; safetyMigration = true; }
  if (!Array.isArray(state.reports)) { state.reports = []; safetyMigration = true; }
  if (!Array.isArray(state.preferences)) { state.preferences = []; safetyMigration = true; }
  state.users = Array.isArray(state.users) ? state.users : [];
  const migrationNeeded = state.users.length !== demoUsers.length || demoUsers.some(account => {
    const found = state.users.find(user => user.id === account.id);
    return !found?.salt || !found?.passwordHash || found.email !== account.email || found.profileId !== account.profileId || found.name !== account.name;
  });
  if (migrationNeeded) state.users = initial().users;
  if (migrationNeeded || safetyMigration) await writeState(state);
  return state;
}
export async function writeState(state) {
  const collection = await mongoCollection();
  if (collection) { await collection.replaceOne({ _id: 'main' }, { _id: 'main', state }, { upsert: true }); return; }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(temp, file);
}
export async function resetState() { const state = initial(); await writeState(state); return state; }
export function getFeed(state, userId) {
  const decided = new Set(state.swipes.filter(s => s.userId === userId).map(s => s.profileId));
  const ownProfileId = state.users?.find(user => user.id === userId)?.profileId;
  const blocked = new Set(state.blocks.filter(block => block.userId === userId).map(block => block.profileId));
  const preferences = getPreferences(state, userId);
  return profiles.filter(p => p.id !== ownProfileId && !blocked.has(p.id) && !decided.has(p.id)
    && (!preferences.city || p.city === preferences.city)
    && (!preferences.interests.length || preferences.interests.some(interest => p.interests.includes(interest))))
    .map(({ likedYou, ...publicProfile }) => publicProfile);
}
export function getPreferences(state, userId) {
  const saved = state.preferences?.find(entry => entry.userId === userId);
  return saved ? { city: saved.city || '', interests: Array.isArray(saved.interests) ? saved.interests : [] } : { city: '', interests: [] };
}
export function getMatches(state, userId) {
  const likes = new Set(state.swipes.filter(s => s.userId === userId && s.direction === 'like').map(s => s.profileId));
  const ownProfileId = state.users?.find(user => user.id === userId)?.profileId;
  const blocked = new Set(state.blocks.filter(block => block.userId === userId).map(block => block.profileId));
  return profiles.filter(p => p.id !== ownProfileId && !blocked.has(p.id) && p.likedYou && likes.has(p.id)).map(({ likedYou, ...match }) => match);
}
export function getBlockedProfiles(state, userId) {
  const blockedIds = new Set(state.blocks.filter(block => block.userId === userId).map(block => block.profileId));
  return profiles.filter(profile => blockedIds.has(profile.id)).map(({ likedYou, ...profile }) => profile);
}
export function blockProfile(state, userId, profileId) {
  if (state.blocks.some(block => block.userId === userId && block.profileId === profileId)) return false;
  state.blocks.push({ userId, profileId, createdAt: new Date().toISOString() });
  return true;
}
export function unblockProfile(state, userId, profileId) {
  const index = state.blocks.findIndex(block => block.userId === userId && block.profileId === profileId);
  if (index < 0) return false;
  state.blocks.splice(index, 1);
  return true;
}
export function reportProfile(state, userId, profileId, reason) {
  state.reports.push({ id: randomUUID(), reporterId: userId, profileId, reason, createdAt: new Date().toISOString() });
}
export function undoLastSwipe(state, userId) {
  let latestIndex = -1;
  for (let i = 0; i < state.swipes.length; i++) {
    if (state.swipes[i].userId === userId && (latestIndex < 0 || state.swipes[i].createdAt >= state.swipes[latestIndex].createdAt)) latestIndex = i;
  }
  return latestIndex < 0 ? null : state.swipes.splice(latestIndex, 1)[0];
}
export function getPublicUser(user) {
  if (!user) return null;
  const profile = profiles.find(p => p.id === user.profileId);
  return { id: user.id, profileId: user.profileId || null, name: user.name, email: user.email, photo: profile?.photo || null, age: profile?.age || null, bio: profile?.bio || null, city: profile?.city || null, interests: profile?.interests || [] };
}
export { profiles };
export { demoUsers, hash };
