import { Pool } from 'pg';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const stringSimilarity = require('string-similarity');
const forbidden = ['fuck', 'boobs', 'shit'];

function isForbidden(username) {
  const normalized = username.toLowerCase().replace(/[0134@$]/g, c => ({'0':'o','1':'i','3':'e','4':'a','@':'a','$':'s'})[c]||c);
  return forbidden.some(word => stringSimilarity.compareTwoStrings(normalized, word) > 0.8);
}

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
    if (isForbidden(username)) {
      return res.status(400).json({ error: 'Username was filtered.' });
    }

    try {
      // WARNING: Storing passwords in plain text is highly discouraged for sensitive applications.
      // This is done based on your explicit request to remove password hashing.
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
