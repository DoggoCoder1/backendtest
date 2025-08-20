const express = require('express');
const app = express();

app.use(express.json()); // This is crucial for parsing JSON data from the request body

// This is the correct route handler for a POST request to your Vercel API endpoint
app.post('/', (req, res) => {
    // Access the data sent from the client
    const clientData = req.body;
    
    console.log('Received POST request with data:', clientData);

    // Send a JSON response back to the client
    res.status(200).json({ 
        success: true, 
        message: 'Data received successfully!',
        data: clientData
    });
});

// A simple GET route is good for testing in your browser
app.get('/', (req, res) => {
    res.status(200).json({ message: 'API is alive!' });
});

module.exports = app;