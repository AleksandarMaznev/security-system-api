const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../_supabase');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '8h';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const { data, error } = await supabase
    .from('admin_credentials')
    .select('id, password_hash, user_id, users(name, role, active)')
    .eq('username', username)
    .single();

  if (error || !data) return res.status(401).json({ error: 'Invalid credentials' });

  if (!data.users.active) return res.status(403).json({ error: 'Account is inactive' });

  const valid = await bcrypt.compare(password, data.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { credential_id: data.id, user_id: data.user_id, name: data.users.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.status(200).json({ access_token: token, expires_in: JWT_EXPIRES_IN });
};
