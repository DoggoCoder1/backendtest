import { Pool } from 'pg';
import jwt from 'jsonwebtoken'; // Import jsonwebtoken to verify tokens

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Neon's SSL
});

// Secret key for JWTs - IMPORTANT: This MUST match the JWT_SECRET in your login.js
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_please_change_this_in_prod';

export default async function handler(req, res) {
  let client; // Declare client outside try-catch for finally block access

  try {
    client = await pool.connect(); // Get a client from the pool

    // --- Authentication Middleware for Chat Endpoints ---
    // All requests to /api/chat will now require a valid JWT token.
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer <token>"

    // If no token is provided, return 401 Unauthorized
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required.' });
    }

    let decoded;
    try {
      // Verify the token using the secret key
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // If token is invalid (e.g., expired, malformed, tampered), return 403 Forbidden
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // Attach the decoded user information (from the token payload) to the request object.
    // This makes user data (like username) available for subsequent chat logic.
    req.user = decoded;

    // --- Chat Message Handling ---
    // This part now assumes the request has been authenticated by the middleware above.
    if (req.url === '/api/chat') {

      // --- GET Request: Fetch messages ---
      if (req.method === 'GET') {
        // Select messages, ordered by timestamp, limit to 50
        const result = await client.query('SELECT username, content, timestamp FROM messages ORDER BY timestamp DESC LIMIT 50');
        return res.status(200).json({ messages: result.rows });
      }

      // --- POST Request: Send a message ---
      if (req.method === 'POST') {
        const { content } = req.body;
        // The username is now taken directly from the authenticated token's payload,
        // ensuring messages are attributed to the logged-in user.
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

    // If the request method or URL does not match any defined routes within /api/chat
    res.status(405).end(); // Method Not Allowed

  } catch (err) {
    // Log any server-side errors that occur outside of specific error handling
    console.error('Server error in chat API:', err);
    res.status(500).json({ error: 'Internal server error in chat API.' });
  } finally {
    // Release the database client back to the pool to prevent connection leaks
    if (client) {
      client.release();
    }
  }
}
