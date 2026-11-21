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
        const { rows } = await sql`
          SELECT i.*, b.customer_name, b.start_date, b.end_date, v.name AS vehicle_name
          FROM invoices i
          JOIN bookings b ON b.id = i.booking_id
          JOIN vehicles v ON v.id = b.vehicle_id
          WHERE i.id = ${id}
        `;
        if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
        return res.status(200).json(rows[0]);
      }
      const { rows } = await sql`
        SELECT i.*, b.customer_name, b.start_date, b.end_date, v.name AS vehicle_name
        FROM invoices i
        JOIN bookings b ON b.id = i.booking_id
        JOIN vehicles v ON v.id = b.vehicle_id
        ORDER BY i.created_at DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { booking_id, amount, status = 'pending', due_date } = req.body;

      if (!booking_id || !amount || !due_date) {
        return res.status(400).json({ error: 'booking_id, amount, and due_date are required' });
      }

      const { rows } = await sql`
        INSERT INTO invoices (booking_id, amount, status, due_date)
        VALUES (${booking_id}, ${amount}, ${status}, ${due_date})
        RETURNING id, booking_id, amount, status, due_date, settled_at, created_at
      `;
      return res.status(201).json(rows[0]);
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'Invoice ID required' });
      const { amount, status, due_date } = req.body;

      const updateFields = [];
      const values = [];
      let paramIdx = 1;

      if (amount !== undefined) {
        updateFields.push(`amount = $${paramIdx++}`);
        values.push(amount);
      }
      if (status !== undefined) {
        updateFields.push(`status = $${paramIdx++}`);
        values.push(status);
        if (status === 'settled') {
          updateFields.push(`settled_at = NOW()`);
        } else if (status === 'pending') {
          updateFields.push(`settled_at = NULL`);
        }
      }
      if (due_date !== undefined) {
        updateFields.push(`due_date = $${paramIdx++}`);
        values.push(due_date);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      const query = `UPDATE invoices SET ${updateFields.join(', ')} WHERE id = $${paramIdx} RETURNING id, booking_id, amount, status, due_date, settled_at, created_at`;
      const { rows } = await sql.query(query, values);

      if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Invoice ID required' });
      await sql`DELETE FROM invoices WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('invoices API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
