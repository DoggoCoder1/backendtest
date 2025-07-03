import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
// Removed bcrypt as password hashing is no longer desired.

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

  try {
    client = await pool.connect(); // Get a client from the pool

    // --- User Registration Endpoint ---
    // Handles POST requests to /api/register for new user creation
    if (req.method === 'POST' && req.url === '/api/register') {
      const { username, password } = req.body;

      // Basic validation for input
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      try {
        // Store the password directly without hashing, as requested.
        // WARNING: Storing passwords in plain text is highly discouraged for sensitive applications.
        // This is done based on your explicit request that "no sensitive info being stored".
        await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, password]);

        return res.status(201).json({ message: 'User registered successfully.' });
      } catch (dbError) {
        // Check for PostgreSQL unique violation error (error code '23505')
        if (dbError.code === '23505') {
          return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
        }
        // Re-throw other database errors for generic 500 handling
        throw dbError;
      }
    }

    // --- User Login Endpoint ---
    // Handles POST requests to /api/login for user authentication
    if (req.method === 'POST' && req.url === '/api/login') {
      const { username, password } = req.body;

      // Basic validation for input
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      // Query the database to find the user by username
      // Fetch the stored password (now plain text)
      const result = await client.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
      const user = result.rows[0];

      // If no user found with that username
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      // Compare the provided password directly with the stored plain-text password
      // WARNING: This is less secure than using bcrypt for password hashing.
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
    }

    // --- Chat Message Handling Endpoint (Requires Authentication) ---
    // Handles GET and POST requests to /api/chat
    if (req.url === '/api/chat') {
      // Extract the authentication token from the Authorization header
      // Format: "Bearer <token>"
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Get the token part

      // If no token is provided, return 401 Unauthorized
      if (!token) {
        return res.status(401).json({ error: 'Authentication token required.' });
      }

      let decoded;
      try {
        // Verify the token using the secret key
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        // If token is invalid (e.g., expired, malformed), return 403 Forbidden
        return res.status(403).json({ error: 'Invalid or expired token.' });
      }

      // Attach the decoded user information to the request object
      // This makes user data (like username) available for subsequent logic
      req.user = decoded;

      // --- GET Request: Fetch messages ---
      if (req.method === 'GET') {
        // Select messages, ordered by timestamp, limit to 50
        const result = await client.query('SELECT username, content, timestamp FROM messages ORDER BY timestamp DESC LIMIT 50');
        return res.status(200).json({ messages: result.rows });
      }

      // --- POST Request: Send a message ---
      if (req.method === 'POST') {
        const { content } = req.body;
        // The username is now taken from the authenticated token, not from client input
        const username = req.user.username;

        // Basic validation for message content
        if (!content) {
          return res.status(400).json({ error: 'Message content is required.' });
        }

        // Insert the new message into the 'messages' table
        await client.query('INSERT INTO messages (username, content) VALUES ($1, $2)', [username, content]);
        return res.status(201).json({ success: true, message: 'Message sent successfully.' });
      }
    }

    // If the request method or URL does not match any defined routes
    res.status(405).end(); // Method Not Allowed

  } catch (err) {
    // Log any server-side errors
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    // Release the database client back to the pool
    if (client) {
      client.release();
    }
  }
}
