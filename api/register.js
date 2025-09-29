import { Pool } from 'pg';
import { google } from 'googleapis';
//AIzaSyBMqi0uWM-3eunUqCFNgPwk4ypTPOMEPug
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  let client;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are supported for registration.' });
  }

  try {
    client = await pool.connect();
    const username = req.body.username ? req.body.username.trim() : '';
    const password = req.body.password;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
      await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, password]);

      return res.status(201).json({ message: 'User registered successfully.' });
    } catch (dbError) {
      // Check for PostgreSQL unique violation error (error code '23505')
      // This ensures that usernames are unique.
      if (dbError.code === '23505') {
        return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
      }
      // Re-throw other database errors for generic 500 handling
      throw dbError;
    }

  } catch (err) {
    // Log any server-side errors
    console.error('Server error during registration:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  } finally {
    // Release the database client back to the pool
    if (client) {
      client.release();
    }
  }
}
