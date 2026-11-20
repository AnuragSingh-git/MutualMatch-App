import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync } from 'node:crypto';
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
const initial = () => ({ version: 1, users: demoUsers.map(u => { const salt = randomBytes(16).toString('hex'); return { id: u.id, profileId: u.profileId, name: u.name, email: u.email, salt, passwordHash: hash(u.password, salt) }; }), swipes: [] });
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
  state.users = Array.isArray(state.users) ? state.users : [];
  const migrationNeeded = state.users.length !== demoUsers.length || demoUsers.some(account => {
    const found = state.users.find(user => user.id === account.id);
    return !found?.salt || !found?.passwordHash || found.email !== account.email || found.profileId !== account.profileId || found.name !== account.name;
  });
  if (!migrationNeeded) return state;
  state.users = initial().users;
  await writeState(state);
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
  return profiles.filter(p => p.id !== ownProfileId && !decided.has(p.id)).map(({ likedYou, ...publicProfile }) => publicProfile);
}
export function getMatches(state, userId) {
  const likes = new Set(state.swipes.filter(s => s.userId === userId && s.direction === 'like').map(s => s.profileId));
  const ownProfileId = state.users?.find(user => user.id === userId)?.profileId;
  return profiles.filter(p => p.id !== ownProfileId && p.likedYou && likes.has(p.id)).map(({ likedYou, ...match }) => match);
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
