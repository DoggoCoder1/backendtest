import { Pool } from 'pg';
import { google } from 'googleapis';

// --- Configuration and AI Setup (Perspective API) ---
const API_KEY = process.env.PERSPECTIVE_; 

const perspective = google.commentanalyzer({
  version: 'v1alpha1',
  auth: API_KEY, // Use the API Key for authorization
});

// --- Synchronous Filtering Function ---
// Define the basic, fast filtering function here.
const FORBIDDEN_WORDS = [
  'admin', 'administrator', 'root', 'moderator', 'support', 
  'official', 'system', // Reserved names
  // Add common profanity or specific filtered words here
  'fuck', 'shit', 'cunt', 'asshole' 
];

// Regex for common undesirable patterns (e.g., non-alphanumeric/underscore/dot)
const ILLEGAL_CHARS_PATTERN = /[^a-zA-Z0-9_.]/; 

function isForbidden(username) {
  const normalizedUsername = username.toLowerCase().trim();

  // 1. Length Check
  if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
    return true; 
  }

  // 2. Reserved/Forbidden Word Check
  for (const word of FORBIDDEN_WORDS) {
    if (normalizedUsername.includes(word)) {
      return true;
    }
  }

  // 3. Illegal Character Pattern Check
  if (ILLEGAL_CHARS_PATTERN.test(username)) {
    return true;
  }

  return false;
}

// --- Asynchronous AI Filtering Function ---

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
  
  const TOXICITY_THRESHOLD = 0.7; // Define your strictness level

  const request = {
    comment: { text: username }, 
    requestedAttributes: {
      'TOXICITY': {},
      'THREAT': {},
      'INSULT': {}
    },
    clientToken: `username-check-${Date.now()}`,
  };

  try {
    const response = await perspective.comments.analyze({ resource: request });
    
    const attributeScores = response.data.attributeScores;
    const toxicityScore = attributeScores.TOXICITY?.summaryScore?.value || 0;
    
    const isToxic = toxicityScore >= TOXICITY_THRESHOLD;

    if (isToxic) {
        console.log(`Username "${username}" flagged with Toxicity score: ${toxicityScore}`);
        return true;
    }
    
    return false;

  } catch (error) {
    // Log the API error but fail safe (allow registration) to keep the app running
    console.error('Perspective API Error (Allowing Registration):', error.message);
    return false; 
  }
}

// --- Database Setup ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- Next.js API Handler ---
export default async function handler(req, res) {
  let client;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are supported for registration.' });
  }

  try {
    client = await pool.connect();
    const username = req.body.username ? req.body.username.trim() : '';
    const password = req.body.password;
    
    // --- Initial Validation ---
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    
    // 1. SYNCHRONOUS Filtering (Fast and simple checks)
    if (isForbidden(username)) {
      return res.status(400).json({ error: 'Username was filtered by basic rules (e.g., length, reserved words).' });
    }

    // 2. ASYNCHRONOUS AI Filtering (Contextual, powerful check)
    const isToxic = await isUsernameToxic(username);
    if (isToxic) {
        // Use a different error message to distinguish between basic and AI filter
        return res.status(400).json({ error: 'Username violates community standards (AI detected offensive content).' });
    }
    
    // --- Database Insertion ---
    try {
      // Assuming you have a proper password hashing utility (not shown here)
      // For this example, we use the raw password as a placeholder. You MUST hash this in production!
      await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, password]); 

      return res.status(201).json({ message: 'User registered successfully.' });
      
    } catch (dbError) {
      // Check for PostgreSQL unique violation error (code '23505')
      if (dbError.code === '23505') {
        return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
      }
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