export default function handler(req, res) {
  if (req.method === 'POST') {
    res.status(200).json({ message: 'POST request received', body: req.body });
  } else if (req.method === 'GET') {
    res.status(200).json({ message: 'GET request received' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
