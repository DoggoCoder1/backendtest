const API_KEY = process.env.PERSPECTIVE_; 

// Define the API endpoint
const PERSPECTIVE_URL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

/**
 * Analyzes a text string and logs the toxicity and threat scores using native fetch.
 * @param {string} text The string to analyze.
 */
async function analyze(text) {
  if (!API_KEY) {
      console.error("PERSPECTIVE_ environment variable is missing.");
      return;
  }

  // 1. Construct the API URL with the key as a query parameter
  const url = `${PERSPECTIVE_URL}?key=${API_KEY}`;

  // 2. Construct the request body
  const requestBody = {
    comment: { text: text }, 
    requestedAttributes: {
      'TOXICITY': {},
      'THREAT': {}
    },
    doNotStore: true, // Recommended for production use
  };

  try {
    // 3. Make the POST request using fetch
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    // Check for non-200 HTTP status codes
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Perspective API HTTP Error: ${response.status} - ${errorData.error.message}`);
    }

    const data = await response.json();
    
    const attributeScores = data.attributeScores;
    
    // 4. Extract the specific score values
    const toxicityScore = attributeScores.TOXICITY?.summaryScore?.value;
    const threatScore = attributeScores.THREAT?.summaryScore?.value;

    // 5. Console.log the result
    console.log(`--- Analysis for: "${text}" ---`);
    console.log(`TOXICITY Score: ${toxicityScore}`); 
    console.log(`THREAT Score: ${threatScore}`);     
    console.log("-------------------------------------");

  } catch (error) {
    console.error('Perspective API Error:', error.message);
  }
}

// --- Main Handler to Run the Test ---
export default async function handler(req, res) {
  // Use the analyze function here
  await analyze("I hate you I hope you die");
  
  res.status(200).json({ message: 'Perspective API test complete (via fetch). Check Vercel logs for scores.' });
}