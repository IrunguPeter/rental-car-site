import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { withClient } from './_db.js';

const COOKIE_NAME = 'aurora_admin_session';
const SESSION_HOURS = Math.max(1, Math.min(168, Number(process.env.ADMIN_SESSION_HOURS) || 8));
const MAX_FAILED_PER_ACCOUNT = 5;
const MAX_FAILED_PER_IP = 20;
const WINDOW_MINUTES = 15;
const LOCK_MINUTES = 30;

// A fixed hash used when an account does not exist, so login timing does not
// reveal whether an email address is registered.
export const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [algorithm, saltHex, hashHex] = String(stored || '').split('$');
    if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    if (!expected.length) return false;
    const actual = scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function requestMeta(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || String(req.headers['x-real-ip'] || '') || 'unknown';
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 300);
  const host = String(req.headers.host || '');
  const proto = String(req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https'));
  const origin = `${proto.split(',')[0].trim()}://${host}`;
  return { ip, userAgent, origin };
}

export function tokenCookie(req) {
  const header = String(req.headers.cookie || '');
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return cookies[COOKIE_NAME] || '';
}

function tokenHash(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function isSessionToken(token) {
  return /^[a-f0-9]{64}$/.test(String(token || ''));
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`
  );
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

export async function getSession(req) {
  const token = tokenCookie(req);
  if (!isSessionToken(token)) return null;

  return withClient(async (client) => {
    const result = await client.query(
      `SELECT u.id, u.email, u.full_name, u.role, s.expires_at
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = TRUE`,
      [tokenHash(token)]
    );
    return result.rows[0] || null;
  });
}

export async function requireAdmin(req, res) {
  const admin = await getSession(req);
  if (!admin) {
    res.status(401).json({ error: 'Please sign in to continue' });
    return null;
  }
  req.admin = admin;
  return admin;
}

export async function requireRole(req, res, roles) {
  const admin = await requireAdmin(req, res);
  if (!admin) return null;
  if (!roles.includes(admin.role)) {
    res.status(403).json({ error: 'Your account does not have access to this action' });
    return null;
  }
  return admin;
}

export async function logAudit(req, action, entity, details = {}) {
  try {
    const meta = requestMeta(req);
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO admin_audit_log (actor_id, actor_email, action, entity, details, ip)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.admin?.id || null, req.admin?.email || null, action, entity, JSON.stringify(details), meta.ip]
      );
    });
  } catch (error) {
    console.error('audit log error:', error);
  }
}

// Mutations from the dashboard send a custom header and a same-origin Origin.
// This blocks cross-site form/Image POSTs even if a cookie is present.
export function assertCsrf(req, res) {
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    res.status(403).json({ error: 'Invalid request origin' });
    return false;
  }

  const origin = req.headers.origin;
  if (origin) {
    const allowed = [requestMeta(req).origin, String(process.env.SITE_URL || '').replace(/\/$/, '')].filter(Boolean);
    if (!allowed.includes(String(origin).replace(/\/$/, ''))) {
      res.status(403).json({ error: 'Invalid request origin' });
      return false;
    }
  }
  return true;
}

export async function checkLoginAllowed(email, ip) {
  return withClient(async (client) => {
    const account = await client.query('SELECT locked_until FROM admin_users WHERE lower(email) = $1', [email]);
    const lockedUntil = account.rows[0]?.locked_until ? new Date(account.rows[0].locked_until) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return { allowed: false, retryAfter: Math.ceil((lockedUntil.getTime() - Date.now()) / 1000) };
    }

    const ipAttempts = await client.query(
      `SELECT COUNT(*)::int AS count FROM admin_login_attempts
       WHERE ip = $1 AND succeeded = FALSE AND created_at > NOW() - INTERVAL '${WINDOW_MINUTES} minutes'`,
      [ip]
    );
    if (ipAttempts.rows[0].count >= MAX_FAILED_PER_IP) {
      return { allowed: false, retryAfter: WINDOW_MINUTES * 60 };
    }

    const accountAttempts = await client.query(
      `SELECT COUNT(*)::int AS count FROM admin_login_attempts
       WHERE lower(email) = $1 AND succeeded = FALSE AND created_at > NOW() - INTERVAL '${WINDOW_MINUTES} minutes'`,
      [email]
    );
    if (accountAttempts.rows[0].count >= MAX_FAILED_PER_ACCOUNT) {
      await client.query(
        'UPDATE admin_users SET locked_until = NOW() + INTERVAL \'30 minutes\' WHERE lower(email) = $1',
        [email]
      );
      return { allowed: false, retryAfter: WINDOW_MINUTES * 60 };
    }

    return { allowed: true };
  });
}

export async function recordLoginAttempt(email, ip, userAgent, succeeded) {
  return withClient(async (client) => {
    await client.query(
      `INSERT INTO admin_login_attempts (email, ip, user_agent, succeeded)
       VALUES ($1, $2, $3, $4)`,
      [email, ip, userAgent, succeeded]
    );
    if (succeeded) {
      await client.query(
        `UPDATE admin_users
         SET last_login_at = NOW(), locked_until = NULL, failed_attempts = 0
         WHERE lower(email) = $1`,
        [email]
      );
      // A successful sign-in clears the failure window for this account.
      await client.query(
        `DELETE FROM admin_login_attempts WHERE lower(email) = $1 AND succeeded = FALSE`,
        [email]
      );
    }
  });
}

export async function createSession(userId, req) {
  const token = randomBytes(32).toString('hex');
  const meta = requestMeta(req);
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO admin_sessions (token_hash, user_id, expires_at, ip, user_agent)
       VALUES ($1, $2, NOW() + make_interval(hours => $3::int), $4, $5)`,
      [tokenHash(token), userId, SESSION_HOURS, meta.ip, meta.userAgent]
    );
  });
  return token;
}

export async function deleteSession(req) {
  const token = tokenCookie(req);
  if (!isSessionToken(token)) return;
  await withClient(async (client) => {
    await client.query('DELETE FROM admin_sessions WHERE token_hash = $1', [tokenHash(token)]);
  });
}

export async function revokeOtherSessions(req) {
  const token = tokenCookie(req);
  const currentHash = isSessionToken(token) ? tokenHash(token) : '';
  await withClient(async (client) => {
    await client.query('DELETE FROM admin_sessions WHERE token_hash <> $1', [currentHash]);
  });
}

export async function getUserByEmail(email) {
  return withClient(async (client) => {
    const result = await client.query(
      'SELECT id, email, full_name, role, is_active, password_hash FROM admin_users WHERE lower(email) = $1',
      [String(email).trim().toLowerCase()]
    );
    return result.rows[0] || null;
  });
}

export async function updatePasswordHash(userId, passwordHash) {
  return withClient(async (client) => {
    await client.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  });
}
