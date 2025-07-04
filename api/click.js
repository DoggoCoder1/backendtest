// /api/click.js

import { verifyToken } from './auth';  // Your JWT/token logic
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Neon connection string
  ssl: { rejectUnauthorized: false }          // needed for Neon
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  const user = await verifyToken(token); // must return { username }

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = await pool.connect();

    const result = await client.query(
      `UPDATE users
       SET click_count = click_count + 1
       WHERE username = $1
       RETURNING click_count`,
      [user.username]
    );

    client.release();

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ clickCount: result.rows[0].click_count });
  } catch (err) {
    console.error('Click error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}
