const supabase = require('../_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { device_id } = req.query;

  const query = supabase.from('devices').select('*');
  if (device_id) query.eq('device_id', device_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ devices: data });
};