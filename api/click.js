const rateLimitWindowMs = 60 * 1000; // 1 minute
const maxRequestsPerWindow = 20; // max 20 clicks per IP per minute

const ipRequestLog = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const now = Date.now();

  if (!ipRequestLog.has(ip)) {
    ipRequestLog.set(ip, []);
  }

  const timestamps = ipRequestLog.get(ip);

  // Remove outdated timestamps older than window
  while (timestamps.length && timestamps[0] <= now - rateLimitWindowMs) {
    timestamps.shift();
  }

  if (timestamps.length >= maxRequestsPerWindow) {
    return res.status(429).json({ error: 'Too many requests from this IP, slow down.' });
  }

  timestamps.push(now);

  // ... your existing logic here (auth + DB update)
  
  // Example to keep your current logic (replace below with your code):
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { username } = JSON.parse(body);
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    const client = await pool.connect();
    const result = await client.query(
      `UPDATE users
       SET click_count = click_count + 1
       WHERE username = $1
       RETURNING click_count`,
      [username]
    );
    client.release();
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ clickCount: result.rows[0].click_count });
  } catch (error) {
    console.error('DB error:', error);
    res.status(500).json({ error: 'Database error or invalid JSON' });
  }
}
