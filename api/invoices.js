import { Client } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
        const result = await client.query(
          `SELECT i.*, b.customer_name, b.start_date, b.end_date, v.name AS vehicle_name
           FROM invoices i
           JOIN bookings b ON b.id = i.booking_id
           JOIN vehicles v ON v.id = b.vehicle_id
           WHERE i.id = $1`,
          [id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found' });
        return res.status(200).json(result.rows[0]);
      }
      const result = await client.query(
        `SELECT i.*, b.customer_name, b.start_date, b.end_date, v.name AS vehicle_name
         FROM invoices i
         JOIN bookings b ON b.id = i.booking_id
         JOIN vehicles v ON v.id = b.vehicle_id
         ORDER BY i.created_at DESC`
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { booking_id, amount, status = 'pending', due_date } = req.body;
      if (!booking_id || !amount || !due_date) {
        return res.status(400).json({ error: 'booking_id, amount, and due_date are required' });
      }
      const result = await client.query(
        'INSERT INTO invoices (booking_id, amount, status, due_date) VALUES ($1, $2, $3, $4) RETURNING id, booking_id, amount, status, due_date, settled_at, created_at',
        [booking_id, amount, status, due_date]
      );
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'Invoice ID required' });
      const { amount, status, due_date } = req.body;
      const fields = [];
      const values = [];
      let paramIdx = 1;
      if (amount !== undefined) { fields.push(`amount = $${paramIdx++}`); values.push(amount); }
      if (status !== undefined) { fields.push(`status = $${paramIdx++}`); values.push(status); }
      if (status === 'settled') { fields.push(`settled_at = NOW()`); }
      else if (status === 'pending') { fields.push(`settled_at = NULL`); }
      if (due_date !== undefined) { fields.push(`due_date = $${paramIdx++}`); values.push(due_date); }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      values.push(id);
      const result = await client.query(`UPDATE invoices SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING id, booking_id, amount, status, due_date, settled_at, created_at`, values);
      if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found' });
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Invoice ID required' });
      await client.query('DELETE FROM invoices WHERE id = $1', [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('invoices API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    await client.end();
  }
}
