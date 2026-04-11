const bcrypt = require('bcryptjs');
const supabase = require('../_supabase');
const { requireAdmin } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  // Fetch current hash
  const { data, error } = await supabase
    .from('admin_credentials')
    .select('id, password_hash')
    .eq('id', admin.credential_id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Credential not found' });

  const valid = await bcrypt.compare(current_password, data.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const new_hash = await bcrypt.hash(new_password, 10);
  const { error: updateError } = await supabase
    .from('admin_credentials')
    .update({ password_hash: new_hash })
    .eq('id', data.id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  return res.status(200).json({ success: true });
};
