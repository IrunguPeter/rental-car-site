import { Client } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
          `SELECT b.id, b.vehicle_id, v.name AS vehicle_name,
                  b.customer_name, b.start_date, b.end_date, b.status, b.created_at
           FROM bookings b
           LEFT JOIN vehicles v ON v.id = b.vehicle_id
           WHERE b.id = $1`,
          [id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Booking not found' });
        return res.status(200).json(result.rows[0]);
      }
      const result = await client.query(
        `SELECT b.id, b.vehicle_id, v.name AS vehicle_name,
                b.customer_name, b.start_date, b.end_date, b.status, b.created_at
         FROM bookings b
         LEFT JOIN vehicles v ON v.id = b.vehicle_id
         ORDER BY b.created_at DESC`
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { vehicle_id, customer_name, start_date, end_date, status = 'pending' } = req.body;
      if (!vehicle_id || !customer_name || !start_date || !end_date) {
        return res.status(400).json({ error: 'vehicle_id, customer_name, start_date, and end_date are required' });
      }
      const result = await client.query(
        'INSERT INTO bookings (vehicle_id, customer_name, start_date, end_date, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, vehicle_id, customer_name, start_date, end_date, status, created_at',
        [vehicle_id, customer_name, start_date, end_date, status]
      );
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Booking ID required' });
      await client.query('DELETE FROM bookings WHERE id = $1', [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('bookings API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    await client.end();
  }
}
