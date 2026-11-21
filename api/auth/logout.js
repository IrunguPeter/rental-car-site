import { noStore } from '../_db.js';
import { assertCsrf, clearSessionCookie, deleteSession, logAudit, requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  noStore(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!assertCsrf(req, res)) return;

  const admin = await requireAdmin(req, res);
  if (admin) await logAudit(req, 'session.signed_out', 'account', { email: admin.email });
  await deleteSession(req);
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
