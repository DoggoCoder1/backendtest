import { Pool } from 'pg';
import { google } from 'googleapis';
const API_KEY = process.env.PERSPECTIVE_API_KEY; 

const perspective = google.commentanalyzer({
  version: 'v1alpha1',
  auth: API_KEY, // Use the API Key for authorization
});

/**
 * Analyzes a username for toxicity using the Perspective API.
 * @param {string} username The username to analyze.
 * @returns {Promise<boolean>} True if the username is flagged as toxic, false otherwise.
 */
export async function isUsernameToxic(username) {
  if (!API_KEY) {
      console.warn("Perspective API Key is missing. Skipping AI check.");
      return false; // Fail safe: if key is missing, allow username.
  }

  const request = {
    // The username is treated as the 'comment'
    comment: { text: username }, 
    
    // Request scores for specific attributes
    requestedAttributes: {
      'TOXICITY': {},
      'THREAT': {},
      'INSULT': {}
    },
    
    // Recommended to provide a session ID (e.g., the user's IP or a random ID)
    clientToken: `username-check-${Date.now()}`,
  };

  try {
    const response = await perspective.comments.analyze({ resource: request });
    
    const attributeScores = response.data.attributeScores;
    
    // DEFINE YOUR THRESHOLD: A score above this value will be flagged. 
    // Perspective scores range from 0 (non-toxic) to 1 (highly toxic). 
    // 0.7 is a common starting point for a strict filter.
    const TOXICITY_THRESHOLD = 0.7; 

    // Check the score for the highest-priority attribute (Toxicity)
    const toxicityScore = attributeScores.TOXICITY?.summaryScore?.value || 0;
    const isToxic = toxicityScore >= TOXICITY_THRESHOLD;

    if (isToxic) {
        console.log(`Username "${username}" flagged with Toxicity score: ${toxicityScore}`);
        return true;
    }
    
    // You could also check other attributes like THREAT or INSULT here if needed

    return false;

  } catch (error) {
    console.error('Perspective API Error:', error.message);
    // CRITICAL: Fail safe. If the API service is down or you hit a rate limit,
    // you should decide whether to block the registration (strict) or allow it (lenient).
    // Allowing it prevents a service outage from stopping user registration.
    return false; 
  }
}
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
    if (isForbidden(username)) {
      return res.status(400).json({ error: 'Username was filtered.' });
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
