// /api/clicks.js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = req.headers['x-username']; // Pass username via custom header

  if (!username) {
    return res.status(400).json({ error: 'Missing username' });
  }

  try {
    const client = await pool.connect();

    if (req.method === 'POST') {
      const result = await client.query(
        `UPDATE users
         SET click_count = click_count + 1
         WHERE username = $1
         RETURNING click_count`,
        [username]
      );

      client.release();

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({ clickCount: result.rows[0].click_count });
    }

    if (req.method === 'GET') {
      const result = await client.query(
        `SELECT click_count FROM users WHERE username = $1`,
        [username]
      );

      client.release();

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({ clickCount: result.rows[0].click_count });
    }
  } catch (err) {
    console.error('Click handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
