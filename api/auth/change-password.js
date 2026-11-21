import { noStore } from '../_db.js';
import {
  assertCsrf,
  getUserByEmail,
  hashPassword,
  logAudit,
  requireAdmin,
  revokeOtherSessions,
  updatePasswordHash,
  verifyPassword,
} from '../_auth.js';

export default async function handler(req, res) {
  noStore(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!assertCsrf(req, res)) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const currentPassword = String(req.body?.current_password || '');
  const newPassword = String(req.body?.new_password || '');
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }
  if (newPassword.length < 12) {
    return res.status(400).json({ error: 'Use at least 12 characters for the new password' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'Choose a different password' });
  }

  const user = await getUserByEmail(admin.email);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  await updatePasswordHash(admin.id, hashPassword(newPassword));
  await revokeOtherSessions(req);
  await logAudit(req, 'password.changed', 'account', { email: admin.email });
  return res.status(200).json({ ok: true });
}
