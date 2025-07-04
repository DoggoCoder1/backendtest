// leaderboard.js (Vercel API route)

import { verifyToken } from './auth'; // or however you verify JWTs
import { getDb } from './db'; // your database connection utility

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await getDb();

    // Fetch top 3 users by click count
    const topUsers = await db
      .collection('users')  // Or whatever table/collection you're using
      .find({})
      .sort({ click_count: -1 })
      .limit(3)
      .project({ username: 1, click_count: 1, _id: 0 }) // Only send needed fields
      .toArray();

    return res.status(200).json({ leaderboard: topUsers });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
