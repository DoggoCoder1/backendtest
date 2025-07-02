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

  try {
    client = await pool.connect();

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      message: 'Hello from the API!'
    }));

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
