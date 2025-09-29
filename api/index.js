import { Pool } from 'pg'; // Included for context, but not used in the test function
const { google } = require('googleapis'); 

// Set the API Key variable from your environment
// NOTE: I'm using your custom name PERSPECTIVE_ 
// You MUST ensure your environment variable is set as PERSPECTIVE_ in Vercel.
const API_KEY = process.env.PERSPECTIVE_; 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize the Perspective client
const perspective = google.commentanalyzer({
  version: 'v1alpha1',
  auth: API_KEY, 
});

/**
 * Analyzes a text string and logs the toxicity and threat scores.
 * @param {string} text The string to analyze.
 */
async function analyze(text) {
  if (!API_KEY) {
      console.error("PERSPECTIVE_ environment variable is missing.");
      return;
  }

  const request = {
    comment: { text: text }, 
    requestedAttributes: {
      'TOXICITY': {}, // Request the Toxicity score
      'THREAT': {}     // Request the Threat score
    },
    clientToken: `test-check-${Date.now()}`,
  };

  try {
    // 1. AWAIT the asynchronous API call
    const response = await perspective.comments.analyze({ resource: request });
    
    const attributeScores = response.data.attributeScores;
    
    // 2. Extract the specific score values from the nested response object
    const toxicityScore = attributeScores.TOXICITY?.summaryScore?.value;
    const threatScore = attributeScores.THREAT?.summaryScore?.value;

    // 3. Console.log the result
    console.log(`--- Analysis for: "${text}" ---`);
    console.log(`TOXICITY Score: ${toxicityScore}`); // Expect this to be high (close to 1.0)
    console.log(`THREAT Score: ${threatScore}`);     // Expect this to be high as well
    console.log("-------------------------------------");

  } catch (error) {
    console.error('Perspective API Error:', error.message);
    // If you see a 403 Forbidden error here, the API key is incorrect or restricted.
  }
}

// --- Main Handler to Run the Test ---
export default async function handler(req, res) {
  // Use the analyze function here
  await analyze("I hate you I hope you die");
  
  // You can run other checks if needed
  // await analyze("I like your hat");

  res.status(200).json({ message: 'Perspective API test complete. Check Vercel logs for scores.' });
}