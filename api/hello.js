import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  const pagePath = '/api/hello';
  try {
    const client = await pool.connect();

    if (req.method === 'POST') {
      const result = await client.query(
        `INSERT INTO page_views (page_path, view_count)
         VALUES ($1, 1)
         ON CONFLICT (page_path) DO UPDATE
         SET view_count = page_views.view_count + 1
         RETURNING view_count;`,
        [pagePath]
      );
      res.status(200).json({ newCount: result.rows[0].view_count, message: 'Click registered successfully.' });
    } else if (req.method === 'GET') {
      const result = await client.query(
        'SELECT view_count FROM page_views WHERE page_path = $1',
        [pagePath]
      );
      res.status(200).json({ pageViewCount: result.rows[0]?.view_count || 0 });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

    client.release();
  } catch (error) {
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
}
