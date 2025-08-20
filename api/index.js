// server.js
const express = require('express');
const app = express();

app.use(express.json());

// if you want to POST:
app.post('/api/index', (req, res) => {
  res.json({ message: 'POST request received', body: req.body });
});

// if you also want GET:
app.get('/api/index', (req, res) => {
  res.json({ message: 'GET request received' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
