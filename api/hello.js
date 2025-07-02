// api/hello.js
import { Pool } from 'pg';

// Initialize a connection pool outside the handler function.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  let client;
  const counterKey = 'global_clicks'; // A fixed key for our single global counter

  try {
    client = await pool.connect();

    let currentViewCount;

    if (req.method === 'POST') {
      // Handle POST requests: Increment the counter
      const upsertQuery = `
        INSERT INTO page_views (page_path, view_count)
        VALUES ($1, 1)
        ON CONFLICT (page_path) DO UPDATE
        SET view_count = page_views.view_count + 1
        RETURNING view_count;
      `;
      const result = await client.query(upsertQuery, [counterKey]);
      currentViewCount = result.rows[0].view_count;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        message: 'Click registered!',
        newCount: currentViewCount
      }));

    } else if (req.method === 'GET') {
      // Handle GET requests: Fetch the current counter value
      const selectQuery = `
        SELECT view_count FROM page_views WHERE page_path = $1;
      `;
      const result = await client.query(selectQuery, [counterKey]);

      if (result.rows.length > 0) {
        currentViewCount = result.rows[0].view_count;
      } else {
        // If the counter doesn't exist yet, initialize it to 0 for GET requests
        // (It will be created with 1 on the first POST/click)
        currentViewCount = 0;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        message: 'Current count fetched.',
        currentCount: currentViewCount,
        timestamp: new Date().toISOString()
      }));

    } else {
      // Handle any other HTTP methods
      res.statusCode = 405; // Method Not Allowed
      res.setHeader('Allow', 'GET, POST');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    }

  } catch (error) {
    console.error('Database or API error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Failed to process request',
      details: error.message
    }));
  } finally {
    if (client) {
      client.release();
    }
  }
}
