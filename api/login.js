import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Neon's SSL
});

// Secret key for JWTs - IMPORTANT: Store this securely in an environment variable in production!
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_please_change_this_in_prod';

export default async function handler(req, res) {
  let client; // Declare client outside try-catch for finally block access

  // This API endpoint specifically handles POST requests for user login
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are supported for login.' });
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

    // Query the database to find the user by username, including their role
    const result = await client.query('SELECT id, username, password_hash, role FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    // If no user found with that username
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Compare the provided password directly with the stored plain-text password
    const passwordMatch = (password === user.password_hash);

    // If passwords do not match
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // If authentication is successful, generate a JSON Web Token (JWT)
    // The JWT payload now includes the user's role
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role }, // Payload data
      JWT_SECRET,                                  // Secret key for signing
      { expiresIn: '1h' }                           // Token expiration time (e.g., 1 hour)
    );

    // Return the token, username, and role to the client
    return res.status(200).json({ token, username: user.username, role: user.role });

  } catch (err) {
    // Log any server-side errors
    console.error('Server error during login:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  } finally {
    // Release the database client back to the pool
    if (client) {
      client.release();
    }
  }
}
