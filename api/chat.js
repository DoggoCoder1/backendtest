import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  let client;

  try {
    client = await pool.connect();

    if (req.method === 'GET') {
      const result = await client.query('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 50');
      return res.status(200).json({ messages: result.rows });
    }

    if (req.method === 'POST') {
      const { username, content } = req.body;
      if (!username || !content) return res.status(400).json({ error: 'Missing data' });

      await client.query('INSERT INTO messages (username, content) VALUES ($1, $2)', [username, content]);
      return res.status(201).json({ success: true });
    }

    res.status(405).end(); // Method Not Allowed

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (client) client.release();
  }
}
