const supabase = require('../_supabase');
const { requireAdmin } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAdmin(req, res);
  if (!user) return;

  // Single user detail with enrolled devices
  if (req.query.id) {
    const userId = Number(req.query.id);

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, name, role, active, enrolled_by, enrolled_at')
      .eq('id', userId)
      .single();

    if (userErr || !userRow) return res.status(404).json({ error: 'User not found' });

    const { data: fingerprints, error: fpErr } = await supabase
      .from('user_fingerprints')
      .select('id, device_id, fingerprint_id, enrolled_at, active, devices(device_id, location, last_seen, status)')
      .eq('user_id', userId);

    if (fpErr) return res.status(500).json({ error: fpErr.message });

    return res.status(200).json({ user: userRow, fingerprints: fingerprints ?? [] });
  }

  // Full user list
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, active, enrolled_by, enrolled_at')
    .order('enrolled_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ users: data });
};
