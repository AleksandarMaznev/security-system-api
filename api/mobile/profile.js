const supabase = require('../_supabase');
const { requireAdmin } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { data, error } = await supabase
    .from('admin_credentials')
    .select('username')
    .eq('id', admin.credential_id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Profile not found' });

  return res.status(200).json({ username: data.username, name: admin.name });
};
