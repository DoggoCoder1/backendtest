// /api/leaderboard.js

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Neon
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    client = await pool.connect();

    const result = await client.query(`
      SELECT username, click_count
      FROM users
      ORDER BY click_count DESC
      LIMIT 10;
    `);

    return res.status(200).json({ leaderboard: result.rows });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
}
