import { noStore, withClient } from '../../_db.js';
import { assertCsrf, hashPassword, logAudit, requireRole } from '../../_auth.js';

export default async function handler(req, res) {
  noStore(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!assertCsrf(req, res)) return;

  const admin = await requireRole(req, res, ['admin']);
  if (!admin) return;

  const id = Number(req.body?.user_id);
  const password = String(req.body?.new_password || '');
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Valid user ID required' });
  }
  if (password.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters' });
  }

  const result = await withClient(async (client) => {
    const user = await client.query('SELECT email FROM admin_users WHERE id = $1', [id]);
    if (!user.rows.length) return { missing: true };
    await client.query('UPDATE admin_users SET password_hash = $1, locked_until = NULL, failed_attempts = 0 WHERE id = $2', [hashPassword(password), id]);
    await client.query('DELETE FROM admin_sessions WHERE user_id = $1', [id]);
    await client.query('DELETE FROM admin_login_attempts WHERE lower(email) = $1 AND succeeded = FALSE', [user.rows[0].email.toLowerCase()]);
    return { email: user.rows[0].email };
  });

  if (result.missing) return res.status(404).json({ error: 'Account not found' });
  await logAudit(req, 'user.password_reset', 'user', { id, email: result.email });
  return res.status(200).json({ ok: true });
}
