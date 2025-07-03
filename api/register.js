import { Pool } from 'pg';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Neon's SSL
});

export default async function handler(req, res) {
  let client; // Declare client outside try-catch for finally block access

  // This API endpoint specifically handles POST requests for user registration
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are supported for registration.' });
  }

  try {
    client = await pool.connect(); // Get a client from the pool
    // Trim whitespace from username before processing
    const username = req.body.username ? req.body.username.trim() : '';
    const password = req.body.password;

    // Basic validation for input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
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
