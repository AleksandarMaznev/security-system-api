const supabase = require('../_supabase');
const { requireAdmin } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAdmin(req, res);
  if (!user) return;

  const { device_id, user_id, limit = 100, offset = 0 } = req.query;

  let query = supabase
    .from('access_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (device_id) query = query.eq('device_id', device_id);

  if (user_id) {
    const { data: fps } = await supabase
      .from('user_fingerprints')
      .select('fingerprint_id')
      .eq('user_id', Number(user_id));

    const ids = (fps ?? []).map(r => r.fingerprint_id);
    if (ids.length === 0) return res.status(200).json({ logs: [] });
    query = query.in('fingerprint_id', ids);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ logs: data });
};
