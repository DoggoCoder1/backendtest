import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_CLICKS_PER_WINDOW = 1000; // Max clicks per IP per window

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return realIP || cfConnectingIP || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
}

// Create rate_limits table in your DB:
// CREATE TABLE IF NOT EXISTS rate_limits (
//   ip TEXT PRIMARY KEY,
//   count INT NOT NULL,
//   window_start TIMESTAMP NOT NULL
// );

async function isRateLimited(client, ip) {
  const now = new Date();

  // Lock row for update to avoid race conditions
  const res = await client.query(
    'SELECT count, window_start FROM rate_limits WHERE ip = $1 FOR UPDATE',
    [ip]
  );

  if (res.rowCount === 0) {
    // No record, insert new one
    await client.query(
      'INSERT INTO rate_limits (ip, count, window_start) VALUES ($1, 1, $2)',
      [ip, now]
    );
    return false;
  }

  const { count, window_start } = res.rows[0];
  const windowStartTime = new Date(window_start);
  const elapsed = now - windowStartTime;

  if (elapsed > RATE_LIMIT_WINDOW_MS) {
    // Window expired, reset
    await client.query(
      'UPDATE rate_limits SET count = 1, window_start = $2 WHERE ip = $1',
      [ip, now]
    );
    return false;
  }

  if (count >= MAX_CLICKS_PER_WINDOW) {
    // Rate limit exceeded
    return true;
  }

  // Increment count
  await client.query(
    'UPDATE rate_limits SET count = count + 1 WHERE ip = $1',
    [ip]
  );

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let username;
  try {
    username = JSON.parse(body).username;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  const clientIP = getClientIP(req);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (await isRateLimited(client, clientIP)) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        error: 'fuck off twink'
      });
    }

    const result = await client.query(
      `UPDATE users
       SET click_count = click_count + 1
       WHERE username = $1
       RETURNING click_count`,
      [username]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    await client.query('COMMIT');

    res.status(200).json({ clickCount: result.rows[0].click_count });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('DB error:', error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
}
