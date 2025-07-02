import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  let client;

  try {
    client = await pool.connect();

    // Check maintenance mode flag from DB
    const maintenanceRes = await client.query(
      "SELECT value FROM settings WHERE key = 'maintenance_mode'"
    );
    const maintenance = maintenanceRes.rows[0]?.value === 'true';

    if (maintenance) {
      return res.status(503).json({ message: 'Maintenance' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const now = new Date();

    if (req.method === 'POST') {
      // Increment page view count
      await client.query(`
        INSERT INTO page_views (page_path, view_count)
        VALUES ($1, 1)
        ON CONFLICT (page_path) DO UPDATE
        SET view_count = page_views.view_count + 1
      `, ['/api/hello']);
    }

    // Track online users
    await client.query(`
      INSERT INTO online_users (ip, last_seen)
      VALUES ($1, $2)
      ON CONFLICT (ip) DO UPDATE SET last_seen = EXCLUDED.last_seen
    `, [ip, now]);

    // Count users active in last 30 seconds
    const activeCutoff = new Date(Date.now() - 30_000); // 30 seconds ago
    const onlineRes = await client.query(`
      SELECT COUNT(*) AS online FROM online_users
      WHERE last_seen > $1
    `, [activeCutoff]);

    // Get current page view count
    const viewRes = await client.query(`
      SELECT view_count FROM page_views WHERE page_path = $1
    `, ['/api/hello']);

    res.status(200).json({
      pageViewCount: viewRes.rows[0]?.view_count ?? 0,
      onlineUsers: Number(onlineRes.rows[0].online)
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  } finally {
    if (client) client.release();
  }
}
