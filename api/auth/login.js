import { noStore } from '../_db.js';
import {
  DUMMY_HASH,
  checkLoginAllowed,
  createSession,
  getUserByEmail,
  recordLoginAttempt,
  requestMeta,
  setSessionCookie,
  verifyPassword,
} from '../_auth.js';

export default async function handler(req, res) {
  noStore(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (email.length > 254 || password.length > 200) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const meta = requestMeta(req);
  const gate = await checkLoginAllowed(email, meta.ip);
  if (!gate.allowed) {
    res.setHeader('Retry-After', String(gate.retryAfter || 60));
    return res.status(429).json({ error: 'Too many attempts. Please wait before trying again.' });
  }

  const user = await getUserByEmail(email);
  // Always run the same password work, even for unknown or disabled accounts.
  const validPassword = verifyPassword(password, user?.password_hash || DUMMY_HASH);
  const succeeded = !!user && user.is_active && validPassword;
  await recordLoginAttempt(email, meta.ip, meta.userAgent, succeeded);

  if (!succeeded) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = await createSession(user.id, req);
  setSessionCookie(res, token);
  return res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.full_name || user.email,
      role: user.role,
    },
  });
}
