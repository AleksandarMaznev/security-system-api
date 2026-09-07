const supabase = require('../_supabase');

// POST /api/devices/heartbeat
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { device_id, firmware_version } = req.body || {};
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });

  const now = new Date().toISOString();
  const upsertRow = { device_id, last_seen: now, status: 'online' };
  if (firmware_version) upsertRow.firmware_version = firmware_version;

  const { error } = await supabase
    .from('devices')
    .upsert(upsertRow, { onConflict: 'device_id' });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true, server_time: now });
};