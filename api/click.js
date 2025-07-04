import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    // Manually parse body (since Vercel doesn’t auto-parse in vanilla handler)
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    const { username } = JSON.parse(body);

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    const client = await pool.connect();

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

    res.status(200).json({ clickCount: result.rows[0].click_count });
  } catch (error) {
    console.error('DB error:', error);
    res.status(500).json({ error: 'Database error or invalid JSON' });
  }
}
