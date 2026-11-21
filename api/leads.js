import { Client } from 'pg';

function setCors(res, req) {
  const allowedOrigin = process.env.SITE_URL;
  const origin = req.headers.origin;
  if (allowedOrigin && origin === allowedOrigin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email = '', message } = req.body || {};
  if (!name || !phone || !message) {
    return res.status(400).json({ error: 'Name, phone, and message are required' });
  }
  if (String(name).trim().length < 2 || String(phone).trim().length < 7) {
    return res.status(400).json({ error: 'Please provide a valid name and phone number' });
  }
  if (String(message).trim().length < 10) {
    return res.status(400).json({ error: 'Please include a little more detail about your trip' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) return res.status(500).json({ error: 'Enquiry service is not configured' });

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const result = await client.query(
      `INSERT INTO leads (name, phone, email, message)
       VALUES ($1, $2, NULLIF($3, ''), $4)
       RETURNING id, created_at`,
      [String(name).trim(), String(phone).trim(), String(email).trim(), String(message).trim()]
    );
    return res.status(201).json({ success: true, lead_id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (error) {
    console.error('leads API error:', error);
    return res.status(500).json({ error: 'We could not save your enquiry. Please try WhatsApp instead.' });
  } finally {
    await client.end();
  }
}
