import { Pool } from 'pg';
import { verifyToken } from './auth'; // your JWT verification logic

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed, use GET' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const client = await pool.connect();

    const result = await client.query(
      'SELECT click_count FROM users WHERE username = $1',
      [user.username]
    );

    client.release();

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ clickCount: result.rows[0].click_count });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
