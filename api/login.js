import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Neon's SSL
});

// Secret key for JWTs - IMPORTANT: Store this securely in an environment variable in production!
// For Vercel, set this in your project's Environment Variables.
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_please_change_this_in_prod';

export default async function handler(req, res) {
  let client; // Declare client outside try-catch for finally block access

  // This API endpoint specifically handles POST requests for user login
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are supported for login.' });
  }

  try {
    client = await pool.connect(); // Get a client from the pool
    const { username, password } = req.body;

    // Basic validation for input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Query the database to find the user by username
    // We fetch the stored password (now plain text as per your previous request)
    const result = await client.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    // If no user found with that username
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Compare the provided password directly with the stored plain-text password
    // WARNING: This is less secure than using bcrypt for password hashing.
    // This direct comparison is based on your explicit request to remove password hashing.
    const passwordMatch = (password === user.password_hash);

    // If passwords do not match
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // If authentication is successful, generate a JSON Web Token (JWT)
    // The JWT payload includes user ID and username for identification in subsequent requests
    const token = jwt.sign(
      { userId: user.id, username: user.username }, // Payload data
      JWT_SECRET,                                  // Secret key for signing
      { expiresIn: '1h' }                           // Token expiration time (e.g., 1 hour)
    );

    // Return the token and username to the client
    return res.status(200).json({ token, username: user.username });

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
