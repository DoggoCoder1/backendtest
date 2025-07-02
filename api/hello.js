// pages/api/hello.js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  let client;
  try {
    client = await pool.connect();
    const pagePath = '/api/hello';

    if (req.method === 'POST') {
      // Handle a POST request to increment the count
      const upsertQuery = `
        INSERT INTO page_views (page_path, view_count)
        VALUES ($1, 1)
        ON CONFLICT (page_path) DO UPDATE
        SET view_count = page_views.view_count + 1
        RETURNING view_count;
      `;
      const result = await client.query(upsertQuery, [pagePath]);
      const newCount = result.rows[0].view_count;

      res.status(200).json({
        newCount,
        message: 'Click registered successfully.'
      });

    } else if (req.method === 'GET') {
      // Handle a GET request to fetch the current count
      const result = await client.query(
        'SELECT view_count FROM page_views WHERE page_path = $1',
        [pagePath]
      );

      const count = result.rows.length > 0 ? result.rows[0].view_count : 0;

      res.status(200).json({ pageViewCount: count });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Database or API error:', error);
    res.status(500).json({
      error: 'Failed to process request',
      details: error.message
    });
  } finally {
    if (client) client.release();
  }
}
