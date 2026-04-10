const supabase = require('../../_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });

  // Verify the user has an active fingerprint on this device
  const { data: fpData, error: fpFetchError } = await supabase
    .from('user_fingerprints')
    .select('fingerprint_id')
    .eq('user_id', id)
    .eq('device_id', device_id)
    .eq('active', true)
    .single();

  if (fpFetchError) return res.status(500).json({ error: fpFetchError.message });
  if (!fpData) return res.status(404).json({ error: 'No active fingerprint found for this user on this device' });

  // Update role in users table
  const { error: userError } = await supabase
    .from('users')
    .update({ role: 'standard' })
    .eq('id', id);

  if (userError) return res.status(500).json({ error: userError.message });

  // Queue demote command to the specific device
  const { error: cmdError } = await supabase
    .from('command_queue')
    .insert([{
      device_id,
      command: 'demote_to_user',
      payload: { fingerprint_id: fpData.fingerprint_id },
      valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }]);

  if (cmdError) return res.status(500).json({ error: cmdError.message });

  return res.status(200).json({ success: true });
};