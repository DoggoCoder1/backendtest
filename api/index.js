export default async function handler(req, res) {
  res.status(200).json({ message: 'Perspective API test complete. Check Vercel logs for scores.' });
}