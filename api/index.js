// api/index.js

const express = require('express');
const app = express();

// Middleware to parse incoming JSON data. This MUST be at the top.
app.use(express.json());

// This is the POST route that will handle requests from your HTML page.
// The route path is '/', because Vercel routes requests from /api to this file's root.
app.post('/', (req, res) => {
  try {
    const dataFromClient = req.body;

    // Check if the request body is empty or not as expected
    if (!dataFromClient || Object.keys(dataFromClient).length === 0) {
      return res.status(400).json({ error: "No data received in the request body." });
    }

    // Log the received data for debugging
    console.log('Received POST request with data:', dataFromClient);

    // Send a success response back to the client
    const responseData = {
      message: "Data received successfully!",
      receivedData: dataFromClient,
      timestamp: new Date().toISOString()
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// A GET route to test if the API is running correctly via the browser.
app.get('/', (req, res) => {
  res.status(200).json({ message: "API is alive and ready to receive POST requests!" });
});

// This is necessary to expose your app as a serverless function on Vercel.
module.exports = app;