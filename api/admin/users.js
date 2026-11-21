import { noStore, withClient } from '../_db.js';
import { assertCsrf, hashPassword, logAudit, requireRole } from '../_auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validRole(role) {
  return role === 'admin' || role === 'worker';
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (req.method !== 'GET' && !assertCsrf(req, res)) return;

  const admin = await requireRole(req, res, ['admin']);
  if (!admin) return;

  if (req.method === 'GET') {
    const result = await withClient(async (client) => {
      const users = await client.query(
        `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.last_login_at, u.locked_until, u.created_at,
                COUNT(s.token_hash)::int AS active_sessions
         FROM admin_users u
         LEFT JOIN admin_sessions s ON s.user_id = u.id AND s.expires_at > NOW()
         GROUP BY u.id
         ORDER BY u.role, u.email`
      );
      return users.rows;
    });
    return res.status(200).json({ users: result });
  }

  if (req.method === 'POST') {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const fullName = String(req.body?.full_name || '').trim();
    const role = String(req.body?.role || 'worker');
    const password = String(req.body?.password || '');

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (!validRole(role)) return res.status(400).json({ error: 'Choose admin or worker' });
    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' });
    }

    try {
      const created = await withClient(async (client) => {
        const result = await client.query(
          `INSERT INTO admin_users (email, full_name, role, password_hash, is_active)
           VALUES ($1, $2, $3, $4, TRUE)
           RETURNING id, email, full_name, role, is_active, created_at`,
          [email, fullName || null, role, hashPassword(password)]
        );
        return result.rows[0];
      });
      await logAudit(req, 'user.created', 'user', { email, role });
      return res.status(201).json({ user: created });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'An account with that email already exists' });
      }
      console.error('create user error:', error);
      return res.status(500).json({ error: 'Could not create the account' });
    }
  }

  // PUT — change a user's role, name, or active state.
  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Valid user ID required' });
  }

  const fields = [];
  const values = [];
  let index = 1;
  const fullName = req.body?.full_name;
  const role = req.body?.role;
  const isActive = req.body?.is_active;

  if (fullName !== undefined) {
    fields.push(`full_name = $${index++}`);
    values.push(String(fullName).trim().slice(0, 120) || null);
  }
  if (role !== undefined) {
    if (!validRole(role)) return res.status(400).json({ error: 'Choose admin or worker' });
    fields.push(`role = $${index++}`);
    values.push(role);
  }
  if (isActive !== undefined) {
    fields.push(`is_active = $${index++}`);
    values.push(!!isActive);
  }
  if (!fields.length) return res.status(400).json({ error: 'No changes provided' });

  try {
    const updated = await withClient(async (client) => {
      // Never let the signed-in admin remove their own access.
      if (id === admin.id && (role === 'worker' || isActive === false)) {
        return { forbidden: true };
      }
      // Keep at least one active admin.
      if (role === 'worker' || isActive === false) {
        const target = await client.query('SELECT role, is_active FROM admin_users WHERE id = $1', [id]);
        if (target.rows[0]?.role === 'admin' && target.rows[0]?.is_active) {
          const otherAdmins = await client.query(
            `SELECT COUNT(*)::int AS count FROM admin_users
             WHERE role = 'admin' AND is_active = TRUE AND id <> $1`,
            [id]
          );
          if (otherAdmins.rows[0].count === 0) return { forbidden: true };
        }
      }
      const result = await client.query(
        `UPDATE admin_users SET ${fields.join(', ')} WHERE id = $${index} RETURNING id, email, full_name, role, is_active`,
        [...values, id]
      );
      if (!result.rows.length) return { missing: true };
      return { user: result.rows[0] };
    });

    if (updated.forbidden) return res.status(400).json({ error: 'You cannot remove your own admin access or the last admin' });
    if (updated.missing) return res.status(404).json({ error: 'Account not found' });

    await logAudit(req, 'user.updated', 'user', { id, changes: Object.keys(req.body || {}) });
    return res.status(200).json({ user: updated.user });
  } catch (error) {
    console.error('update user error:', error);
    return res.status(500).json({ error: 'Could not update the account' });
  }
}
