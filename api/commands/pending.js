const supabase = require('../_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { device_id } = req.query;
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });

  // Expire stale commands first
  await supabase
    .from('command_queue')
    .update({ status: 'expired' })
    .eq('device_id', device_id)
    .eq('status', 'pending')
    .lt('valid_until', new Date().toISOString());

  // Fetch pending commands
  const { data, error } = await supabase
    .from('command_queue')
    .select('*')
    .eq('device_id', device_id)
    .eq('status', 'pending')
    .gt('valid_until', new Date().toISOString());

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ commands: data });
};