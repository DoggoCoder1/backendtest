import { Pool } from 'pg'; 
const axios = require('axios'); // 👈 NEW: Import axios for HTTP requests

// Set the API Key variable from your environment
const API_KEY = process.env.PERSPECTIVE_; 

// Define the API endpoint
const PERSPECTIVE_URL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// NOTE: The 'perspective' client initialization is removed:
// const perspective = google.commentanalyzer({...});

/**
 * Analyzes a text string and logs the toxicity and threat scores using a direct HTTP request.
 * @param {string} text The string to analyze.
 */
async function analyze(text) {
  if (!API_KEY) {
      console.error("PERSPECTIVE_ environment variable is missing.");
      return;
  }

  const requestBody = {
    comment: { text: text }, 
    requestedAttributes: {
      'TOXICITY': {}, // Request the Toxicity score
      'THREAT': {}     // Request the Threat score
    },
    // The clientToken is optional
    // clientToken: `test-check-${Date.now()}`, 
    // You can also add the 'doNotStore' flag for privacy:
    doNotStore: true, 
  };

  try {
    // 1. Make a direct POST request to the API endpoint
    const url = `${PERSPECTIVE_URL}?key=${API_KEY}`;
    
    const response = await axios.post(url, requestBody);
    
    const attributeScores = response.data.attributeScores;
    
    // 2. Extract the specific score values from the nested response object
    const toxicityScore = attributeScores.TOXICITY?.summaryScore?.value;
    const threatScore = attributeScores.THREAT?.summaryScore?.value;

    // 3. Console.log the result
    console.log(`--- Analysis for: "${text}" ---`);
    // The score is a probability from 0 to 1.0
    console.log(`TOXICITY Score: ${toxicityScore}`); 
    console.log(`THREAT Score: ${threatScore}`);     
    console.log("-------------------------------------");

  } catch (error) {
    // Log a specific error if it's an Axios error
    if (error.response) {
      console.error('Perspective API HTTP Error:', error.response.status, error.response.data);
    } else {
      console.error('Perspective API Error:', error.message);
    }
  }
}

// --- Main Handler to Run the Test ---
export default async function handler(req, res) {
  // Use the analyze function here
  await analyze("I hate you I hope you die");
  
  res.status(200).json({ message: 'Perspective API test complete. Check Vercel logs for scores.' });
}