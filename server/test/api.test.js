import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { profiles as seededProfiles } from '../src/data/profiles.js';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'coy-discover-'));
process.env.DATA_FILE = path.join(temp, 'state.json');
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const { createApp } = await import('../src/app.js');
const server = createApp().listen(0);
let base;
let token;
const request = (url, options={}) => fetch(`${base}${url}`, { ...options, headers: { authorization:`Bearer ${token}`, ...(options.headers||{}) } });
before(async () => { await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'maya@example.com',password:'CoyDemo123!'})}); token=(await login.json()).token; });
after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(temp, {recursive:true,force:true}); });

test('authentication protects private routes and dummy accounts are isolated', async () => {
  assert.equal((await fetch(`${base}/api/feed`)).status,401);
  assert.equal((await fetch(`${base}/feed`)).status,401);
  assert.equal((await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'maya@example.com',password:'wrong'})})).status,401);
  const demo=await (await fetch(`${base}/api/auth/demo-accounts`)).json(); assert.equal(demo.accounts.length,10);
  assert.ok(demo.accounts.every((account,i)=>account.profileId===`p${String(i+1).padStart(3,'0')}`&&account.id===account.profileId&&account.name));
  assert.equal(seededProfiles.filter(profile=>profile.likedYou).length,10);
  for (const account of demo.accounts) {
    const result=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:account.id,password:'CoyDemo123!'})});
    assert.equal(result.status,200,`${account.id} should sign in using its profile ID`);
    const {token:accountToken,user}=await result.json(); assert.equal(user.id,account.profileId);
    const ownFeed=await fetch(`${base}/api/feed`,{headers:{authorization:`Bearer ${accountToken}`}}).then(r=>r.json());
    assert.ok(!ownFeed.profiles.some(profile=>profile.id===account.profileId),`${account.id} should not see itself in Discover`);
  }
  const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'p002',password:'CoyDemo123!'})});
  assert.equal(login.status,200); const loginBody=await login.json(); const secondToken=loginBody.token;
  assert.equal(loginBody.user.name,'Aarav'); assert.equal(loginBody.user.profileId,'p002');
  const feed=await fetch(`${base}/api/feed`,{headers:{authorization:`Bearer ${secondToken}`}}).then(r=>r.json());
  assert.ok(!feed.profiles.some(p=>p.id==='p002'),'a demo user should not see their own profile');
  const liked=await fetch(`${base}/api/swipe`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${secondToken}`},body:JSON.stringify({profileId:'p011',direction:'pass'})}); assert.equal(liked.status,201);
  assert.ok((await (await request('/api/feed')).json()).profiles.some(p=>p.id==='p011'));
  const repeatedLogin=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'maya@example.com',password:'CoyDemo123!'})});
  assert.equal(repeatedLogin.status,200,'the seeded password salt must stay stable across requests');
});
test('feed has at least 30 complete public profiles and never reveals incoming like flags', async () => {
  const r = await request('/api/feed'); assert.equal(r.status, 200);
  const { profiles } = await r.json(); assert.ok(profiles.length >= 30);
  assert.ok(profiles.every(p => p.name && p.age && p.photo && p.bio && p.city && p.interests.length));
  assert.ok(profiles.every(p => !Object.hasOwn(p, 'likedYou')));
  const canonical=await request('/feed'); assert.equal(canonical.status,200);
});
test('only a mutual like returns a match; swiped profiles stay out of feed', async () => {
  assert.equal((await request('/api/swipe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profileId:'p001',direction:'like'})})).status,400);
  let r = await request('/api/swipe', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profileId:'p002',direction:'like'})});
  assert.equal(r.status, 201); assert.equal((await r.json()).matched, true);
  assert.equal((await (await request('/api/matches')).json()).matches.length, 1);
  const feed = await (await request('/api/feed')).json(); assert.ok(!feed.profiles.some(p => p.id === 'p002'));
  r = await request('/api/swipe', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profileId:'p011',direction:'like'})});
  assert.equal((await r.json()).matched, false);
  assert.equal((await (await request('/api/matches')).json()).matches.length, 1);
  const undone=await request('/api/swipe/undo',{method:'POST'}); assert.equal(undone.status,200);
  assert.equal((await undone.json()).swipe.profileId,'p011');
  assert.equal((await (await request('/api/matches')).json()).matches.length, 1);
  assert.ok((await (await request('/api/feed')).json()).profiles.some(p=>p.id==='p011'));
  const undoMatch=await request('/api/swipe/undo',{method:'POST'}); assert.equal((await undoMatch.json()).swipe.profileId,'p002');
  assert.equal((await (await request('/api/matches')).json()).matches.length, 0);
  assert.ok((await (await request('/api/feed')).json()).profiles.some(p=>p.id==='p002'));
});
test('validates input and rejects a duplicate swipe', async () => {
  const post = body => request('/api/swipe', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({profileId:'p003',direction:'maybe'})).status, 400);
  assert.equal((await post({profileId:'bogus',direction:'like'})).status, 400);
  assert.equal((await post({profileId:'p012',direction:'pass'})).status, 201);
  assert.equal((await post({profileId:'p012',direction:'pass'})).status, 409);
  assert.equal((await post({profileId:'p999',direction:'like'})).status, 404);
  const alias=await fetch(`${base}/swipe`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({profileId:'p014',direction:'pass'})});
  assert.equal(alias.status,201,'assignment root-path POST /swipe alias should work');
});
