const supabase = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { fingerprint_id, device_id, result, role_at_time } = req.body;
  if (!fingerprint_id || !device_id || !result) {
    return res.status(400).json({ error: 'fingerprint_id, device_id and result are required' });
  }

  // Log the access event
  const { error: logError } = await supabase
    .from('access_logs')
    .insert([{ fingerprint_id, device_id, result, role_at_time }]);

  if (logError) return res.status(500).json({ error: logError.message });

  // Update last_seen on the device
  const { error: deviceError } = await supabase
    .from('devices')
    .update({ last_seen: new Date().toISOString() })
    .eq('device_id', device_id);

  if (deviceError) return res.status(500).json({ error: deviceError.message });

  return res.status(200).json({ success: true });
};