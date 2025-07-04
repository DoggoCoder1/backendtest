import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Put your secret in env variables! This is just example:
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    // Read token from Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1]; // get token part

    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get username from decoded token payload
    const username = decoded.username;
    if (!username) {
      return res.status(401).json({ error: 'Invalid token payload' });
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
