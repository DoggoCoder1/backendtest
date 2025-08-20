const express = require('express');
const app = express();

app.use(express.json());

// Handle POST requests to the /api endpoint
app.post('/', (req, res) => {
    // This route is for your form/JavaScript to send data
    const clientData = req.body;
    console.log('Received POST request with data:', clientData);
    res.status(200).json({ received: true, data: clientData });
});

// Handle GET requests to the /api endpoint
app.get('/', (req, res) => {
    // This route is so you can test the URL in your browser
    res.status(200).json({ message: 'API is running successfully!' });
});

module.exports = app;