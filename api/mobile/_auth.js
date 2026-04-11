const jwt = require('jsonwebtoken');
const supabase = require('../_supabase');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifies the Bearer JWT and confirms the credential still exists in the database.
 * Returns the decoded payload if valid, otherwise sends an error response and returns null.
 */
async function requireAdmin(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return null;
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }

  // Confirm the credential row still exists (covers demoted/deleted admins)
  const { data, error } = await supabase
    .from('admin_credentials')
    .select('id')
    .eq('id', payload.credential_id)
    .single();

  if (error || !data) {
    res.status(403).json({ error: 'Access revoked' });
    return null;
  }

  return payload;
}

module.exports = { requireAdmin };
