import { Client } from 'pg';
import { noStore } from './_db.js';
import { assertCsrf, logAudit, requireRole } from './_auth.js';

export default async function handler(req, res) {
  noStore(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    if (!assertCsrf(req, res)) return;
    if (!(await requireRole(req, res, ['admin']))) return;
  }

  const { id } = req.query;
  const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'No database URL configured' });
  }

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    if (req.method === 'GET') {
      if (id) {
        const result = await client.query('SELECT * FROM vehicles WHERE id = $1', [id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
        return res.status(200).json(result.rows[0]);
      }
      const result = await client.query('SELECT id, name, type, price, status, created_at FROM vehicles ORDER BY created_at DESC');
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { name, type, price, status = 'available' } = req.body;
      if (!name || !type || !price) {
        return res.status(400).json({ error: 'name, type, and price are required' });
      }
      const result = await client.query(
        'INSERT INTO vehicles (name, type, price, status) VALUES ($1, $2, $3, $4) RETURNING id, name, type, price, status, created_at',
        [name, type, price, status]
      );
      await logAudit(req, 'vehicle.created', 'vehicle', { id: result.rows[0].id, name });
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'Vehicle ID required' });
      const { name, type, price, status } = req.body;
      const fields = [];
      const values = [];
      let paramIdx = 1;
      if (name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(name); }
      if (type !== undefined) { fields.push(`type = $${paramIdx++}`); values.push(type); }
      if (price !== undefined) { fields.push(`price = $${paramIdx++}`); values.push(price); }
      if (status !== undefined) { fields.push(`status = $${paramIdx++}`); values.push(status); }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      values.push(id);
      const result = await client.query(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING id, name, type, price, status, created_at`, values);
      if (!result.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
      await logAudit(req, 'vehicle.updated', 'vehicle', { id: result.rows[0].id, fields: Object.keys(req.body || {}) });
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Vehicle ID required' });
      await client.query('DELETE FROM vehicles WHERE id = $1', [id]);
      await logAudit(req, 'vehicle.deleted', 'vehicle', { id });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('vehicles API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    await client.end();
  }
}
