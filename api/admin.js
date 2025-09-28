import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' });
  const token = req.headers['x-admin-token'];
  if (!token || token !== "1234") {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET click_count = 0');
    await client.query('COMMIT');
    res.status(200).json({ ok: true, message: 'All click counts reset' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('reset error', err);
    res.status(500).json({ error: 'DB error' });
  } finally {
    client.release();
  }
}
