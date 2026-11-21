import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      if (id) {
        const { rows } = await sql`
          SELECT b.id, b.vehicle_id, v.name AS vehicle_name,
                 b.customer_name, b.start_date, b.end_date, b.status, b.created_at
          FROM bookings b
          LEFT JOIN vehicles v ON v.id = b.vehicle_id
          WHERE b.id = ${id}
        `;
        if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
        return res.status(200).json(rows[0]);
      }
      const { rows } = await sql`
        SELECT b.id, b.vehicle_id, v.name AS vehicle_name,
               b.customer_name, b.start_date, b.end_date, b.status, b.created_at
        FROM bookings b
        LEFT JOIN vehicles v ON v.id = b.vehicle_id
        ORDER BY b.created_at DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { vehicle_id, customer_name, start_date, end_date, status = 'pending' } = req.body;

      if (!vehicle_id || !customer_name || !start_date || !end_date) {
        return res.status(400).json({ error: 'vehicle_id, customer_name, start_date, and end_date are required' });
      }

      const { rows } = await sql`
        INSERT INTO bookings (vehicle_id, customer_name, start_date, end_date, status)
        VALUES (${vehicle_id}, ${customer_name}, ${start_date}, ${end_date}, ${status})
        RETURNING id, vehicle_id, customer_name, start_date, end_date, status, created_at
      `;
      return res.status(201).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Booking ID required' });
      await sql`DELETE FROM bookings WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('bookings API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
