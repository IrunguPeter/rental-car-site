import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      if (id) {
        const { rows } = await sql`SELECT * FROM vehicles WHERE id = ${id}`;
        if (!rows.length) return res.status(404).json({ error: 'Vehicle not found' });
        return res.status(200).json(rows[0]);
      }
      const { rows } = await sql`
        SELECT id, name, type, price, status, created_at
        FROM vehicles
        ORDER BY created_at DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { name, type, price, status = 'available' } = req.body;

      if (!name || !type || !price) {
        return res.status(400).json({ error: 'name, type, and price are required' });
      }

      const { rows } = await sql`
        INSERT INTO vehicles (name, type, price, status)
        VALUES (${name}, ${type}, ${price}, ${status})
        RETURNING id, name, type, price, status, created_at
      `;
      return res.status(201).json(rows[0]);
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'Vehicle ID required' });
      const { name, type, price, status } = req.body;
      const { rows } = await sql`
        UPDATE vehicles
        SET name = COALESCE(${name}, name),
            type = COALESCE(${type}, type),
            price = COALESCE(${price}, price),
            status = COALESCE(${status}, status)
        WHERE id = ${id}
        RETURNING id, name, type, price, status, created_at
      `;
      if (!rows.length) return res.status(404).json({ error: 'Vehicle not found' });
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Vehicle ID required' });
      await sql`DELETE FROM vehicles WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('vehicles API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
