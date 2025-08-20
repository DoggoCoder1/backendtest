const express = require('express');
const app = express();

// Middleware to parse incoming JSON data
app.use(express.json());

// The handler for the POST request
app.post('/api', (req, res) => {
  // Access the data sent from the client
  const clientData = req.body;
  
  console.log('Received POST request with data:', clientData);

  // Create a response object
  const serverResponse = {
    received: true,
    data: clientData,
    processedAt: new Date().toISOString()
  };

  // Send the JSON response back to the client
  res.status(200).json(serverResponse);
});

// A simple GET route for testing purposes
app.get('/api', (req, res) => {
  res.status(200).json({ message: 'API is running!' });
});

module.exports = app;