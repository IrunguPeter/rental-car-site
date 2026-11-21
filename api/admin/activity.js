import { noStore, withClient } from '../_db.js';
import { requireRole } from '../_auth.js';

export default async function handler(req, res) {
  noStore(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireRole(req, res, ['admin']);
  if (!admin) return;

  const result = await withClient(async (client) => {
    const [events, logins] = await Promise.all([
      client.query(
        `SELECT id, actor_email, action, entity, details, ip, created_at
         FROM admin_audit_log ORDER BY created_at DESC LIMIT 100`
      ),
      client.query(
        `SELECT email, ip, succeeded, created_at
         FROM admin_login_attempts ORDER BY created_at DESC LIMIT 30`
      ),
    ]);
    return { events: events.rows, logins: logins.rows };
  });

  return res.status(200).json(result);
}
