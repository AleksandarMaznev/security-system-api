const supabase = require('../_supabase');
const { requireAdmin } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAdmin(req, res);
  if (!user) return;

  const { device_id, status, limit = 100, offset = 0 } = req.query;

  let query = supabase
    .from('command_queue')
    .select('*')
    .order('issued_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (device_id) query = query.eq('device_id', device_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ commands: data });
};
