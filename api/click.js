import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// In-memory rate limiting store
const rateLimitStore = new Map();

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_CLICKS_PER_WINDOW = 60; // Max clicks per minute per IP

function getClientIP(req) {
  // Check various headers for the real IP address
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  return realIP || cfConnectingIP || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
}

function isRateLimited(ip) {
  const now = Date.now();
  const key = `${ip}`;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return false;
  }
  
  const record = rateLimitStore.get(key);
  
  // Reset if window has passed
  if (now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return false;
  }
  
  // Increment count
  record.count++;
  
  // Check if limit exceeded
  if (record.count > MAX_CLICKS_PER_WINDOW) {
    return true;
  }
  
  return false;
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    // Get client IP
    const clientIP = getClientIP(req);
    
    // Check rate limit
    if (isRateLimited(clientIP)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please wait before clicking again.',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000) // seconds
      });
    }

    // Manually parse body (since Vercel doesn't auto-parse in vanilla handler)
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