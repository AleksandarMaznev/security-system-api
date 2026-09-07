const supabase = require('../_supabase');

// GET  /api/devices/status?device_id=...   (action=status)
// POST /api/devices/heartbeat              (action=heartbeat)
// POST /api/devices/sync                   (action=sync)
module.exports = async (req, res) => {
  if (req.headers['x-api-key'] !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action } = req.query;

  // --- GET /api/devices/status — unchanged from the original file ---
  if (action === 'status') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { device_id } = req.query;
    const query = supabase.from('devices').select('*');
    if (device_id) query.eq('device_id', device_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ devices: data });
  }

  // --- POST /api/devices/heartbeat ---
  if (action === 'heartbeat') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { device_id, firmware_version } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });

    const now = new Date().toISOString();
    const upsertRow = { device_id, last_seen: now, status: 'online' };
    if (firmware_version) upsertRow.firmware_version = firmware_version;

    const { error } = await supabase.from('devices').upsert(upsertRow, { onConflict: 'device_id' });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true, server_time: now });
  }

  // --- POST /api/devices/sync ---
  if (action === 'sync') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { device_id } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });

    const { data, error } = await supabase
      .from('user_fingerprints')
      .select('fingerprint_id, active, user_id, users(id, name, role, active)')
      .eq('device_id', device_id);
    if (error) return res.status(500).json({ error: error.message });

    const slots = (data ?? [])
      .filter((row) => row.active && row.users && row.users.active)
      .map((row) => ({
        fingerprint_id: row.fingerprint_id,
        user_id: row.users.id,
        name: row.users.name,
        role: row.users.role,
      }));

    const now = new Date().toISOString();
    await supabase
      .from('devices')
      .upsert({ device_id, last_seen: now, status: 'online' }, { onConflict: 'device_id' });

    return res.status(200).json({ success: true, server_time: now, slots });
  }

  return res.status(404).json({ error: `Unknown device action: ${action}` });
};