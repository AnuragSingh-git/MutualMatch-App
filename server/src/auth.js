import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = () => process.env.AUTH_SECRET || 'local-demo-only-change-this-secret-before-deploying';
const sign = value => createHmac('sha256', secret()).update(value).digest('base64url');
export function createToken(user) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, name: user.name, exp: Math.floor(Date.now()/1000)+60*60*24 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload)); const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Math.floor(Date.now()/1000) ? data : null; } catch { return null; }
}
export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const user = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
  if (!user) return res.status(401).json({ error: 'Sign in to continue.' });
  req.user = user;
  next();
}
