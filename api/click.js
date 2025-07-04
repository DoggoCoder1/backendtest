// /api/click.js
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are supported.' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const client = await pool.connect();

    await client.query(
      'UPDATE users SET click_count = click_count + 1 WHERE id = $1',
      [payload.userId]
    );

    const result = await client.query(
      'SELECT click_count FROM users WHERE id = $1',
      [payload.userId]
    );

    client.release();
    return res.status(200).json({ clickCount: result.rows[0].click_count });

  } catch (err) {
    console.error('Click error:', err);
    return res.status(500).json({ error: 'Click failed' });
  }
}
