import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ipCooldown = new Map();

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const country = req.headers['x-vercel-ip-country'] || 'Unknown';

  if (req.method === 'POST') {
    const now = Date.now();
    const last = ipCooldown.get(ip) || 0;
    if (now - last < 1000) {
      return res.status(429).json({ error: 'Too many clicks. Slow down!' });
    }
    ipCooldown.set(ip, now);
  }

  let client;
  try {
    client = await pool.connect();
    const pagePath = '/api/hello';

    if (req.method === 'POST') {
      // Increment global and country-specific count
      await client.query(`
        INSERT INTO page_views (page_path, view_count)
        VALUES ($1, 1)
        ON CONFLICT (page_path) DO UPDATE SET view_count = page_views.view_count + 1;
      `, [pagePath]);

      await client.query(`
        INSERT INTO country_clicks (country_code, click_count)
        VALUES ($1, 1)
        ON CONFLICT (country_code) DO UPDATE SET click_count = country_clicks.click_count + 1;
      `, [country]);

      const result = await client.query(`SELECT view_count FROM page_views WHERE page_path = $1`, [pagePath]);
      const newCount = result.rows[0].view_count;
      return res.status(200).json({ newCount });

    } else if (req.method === 'GET') {
      const result = await client.query('SELECT view_count FROM page_views WHERE page_path = $1', [pagePath]);
      const leaderboard = await client.query('SELECT country_code, click_count FROM country_clicks ORDER BY click_count DESC LIMIT 10');
      return res.status(200).json({
        pageViewCount: result.rows[0]?.view_count ?? 0,
        leaderboard: leaderboard.rows
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('DB error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
}
