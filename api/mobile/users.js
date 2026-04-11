const supabase = require('../_supabase');
const { requireAdmin } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAdmin(req, res);
  if (!user) return;

  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, active, enrolled_by, enrolled_at')
    .order('enrolled_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ users: data });
};
