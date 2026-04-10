const supabase = require('../_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { command_id } = req.body;
  if (!command_id) return res.status(400).json({ error: 'command_id is required' });

  const { error } = await supabase
    .from('command_queue')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString()
    })
    .eq('id', command_id)
    .eq('status', 'pending');

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true });
};