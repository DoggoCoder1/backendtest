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

    // --- Authentication Middleware for All Protected Endpoints ---
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
    req.user = decoded;

    // --- Get All Registered Users Endpoint ---
    if (req.url === '/api/users' && req.method === 'GET') {
      try {
        // Select username and role from the users table.
        const result = await client.query('SELECT username, role FROM users ORDER BY username ASC');
        // Return an array of objects, each with username and role
        return res.status(200).json({ users: result.rows });
      } catch (dbError) {
        console.error('Database error fetching users:', dbError);
        return res.status(500).json({ error: 'Failed to retrieve users from database.' });
      }
    }

    // --- Chat Message Handling ---
    if (req.url === '/api/chat') {

      // --- GET Request: Fetch messages ---
      if (req.method === 'GET') {
        // Select messages and JOIN with users table to get the sender's role
        const result = await client.query(`
          SELECT
              m.username,
              m.content,
              m.timestamp,
              u.role
          FROM
              messages m
          JOIN
              users u ON m.username = u.username
          ORDER BY
              m.timestamp DESC
          LIMIT 50
        `);
        return res.status(200).json({ messages: result.rows });
      }

      // --- POST Request: Send a message ---
      if (req.method === 'POST') {
        const { content } = req.body;
        const username = req.user.username; // Username from authenticated token

        if (!content) {
          return res.status(400).json({ error: 'Message content is required.' });
        }

        await client.query('INSERT INTO messages (username, content) VALUES ($1, $2)', [username, content]);
        return res.status(201).json({ success: true, message: 'Message sent successfully.' });
      }

      // --- DELETE Request: Delete all messages ---
      if (req.method === 'DELETE') {
        await client.query('DELETE FROM messages');
        return res.status(200).json({ success: true, message: 'All messages deleted successfully.' });
      }
    }

    res.status(405).end(); // Method Not Allowed

  } catch (err) {
    console.error('Server error in chat API:', err);
    res.status(500).json({ error: 'Internal server error in chat API.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
