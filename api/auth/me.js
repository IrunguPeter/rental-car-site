import { noStore } from '../_db.js';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  noStore(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  return res.status(200).json({
    user: {
      id: admin.id,
      email: admin.email,
      name: admin.full_name || admin.email,
      role: admin.role,
      expires_at: admin.expires_at,
    },
  });
}
