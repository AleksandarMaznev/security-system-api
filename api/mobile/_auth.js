const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifies the Bearer JWT issued by /api/mobile/login.
 * Returns the decoded payload if valid, otherwise sends an error response and returns null.
 */
function requireAdmin(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

module.exports = { requireAdmin };
