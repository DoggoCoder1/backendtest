// api/hello.js
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

    const upsertQuery = `
      INSERT INTO page_views (page_path, view_count)
      VALUES ($1, 1)
      ON CONFLICT (page_path) DO UPDATE
      SET view_count = page_views.view_count + 1
      RETURNING view_count;
    `;

    const result = await client.query(upsertQuery, [pagePath]);
    const currentViewCount = result.rows[0].view_count;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      message: 'Hello from your vanilla Node.js API!',
      timestamp: new Date().toISOString(),
      pageViewCount: currentViewCount
    }));

  } catch (error) {
    console.error('Database or API error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Failed to process request or record page view',
      details: error.message
    }));
  } finally {
    if (client) {
      client.release();
    }
  }
}