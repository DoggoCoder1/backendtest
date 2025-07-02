import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  let client;

  try {
    client = await pool.connect();
    const now = new Date();

    // Track online user on all requests
    await client.query(`
      INSERT INTO online_users (ip, last_seen)
      VALUES ($1, $2)
      ON CONFLICT (ip) DO UPDATE SET last_seen = EXCLUDED.last_seen
    `, [ip, now]);

    // Count active users in last 30 seconds
    const activeCutoff = new Date(Date.now() - 30_000);
    const result = await client.query(`
      SELECT COUNT(*) AS online FROM online_users
      WHERE last_seen > $1
    `, [activeCutoff]);

    const onlineUsers = Number(result.rows[0]?.online ?? 0);

    if (req.method === 'POST') {
      // Increment page view count
      const update = await client.query(`
        INSERT INTO page_views (page_path, view_count)
        VALUES ($1, 1)
        ON CONFLICT (page_path) DO UPDATE SET view_count = page_views.view_count + 1
        RETURNING view_count
      `, ['/api/hello']);

      const newCount = update.rows[0]?.view_count ?? 0;
      res.status(200).json({ newCount, onlineUsers });
    } else {
      // Get page view count
      const viewResult = await client.query(`
        SELECT view_count FROM page_views WHERE page_path = $1
      `, ['/api/hello']);

      const pageViewCount = viewResult.rows[0]?.view_count ?? 0;
      res.status(200).json({ pageViewCount, onlineUsers });
    }

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  } finally {
    if (client) client.release();
  }
}
