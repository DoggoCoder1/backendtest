import { Pool } from 'pg';
const { google } = require('googleapis'); 

//AIzaSyBMqi0uWM-3eunUqCFNgPwk4ypTPOMEPug

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const perspective = google.commentanalyzer({
  version: 'v1alpha1',
  auth: process.env.PERSPECTIVE_, 
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

      return res.status(201).json({ message: `User registered successfully.` });
    } catch (dbError) {
      if (dbError.code === '23505') {
        return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
      }
      throw dbError;
    }

  } catch (err) {
    console.error('Server error during registration:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
