const supabase = require('../_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { fingerprint_id, device_id, name, role, enrolled_by } = req.body;
  if (!fingerprint_id) return res.status(400).json({ error: 'fingerprint_id is required' });
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });

  // First create the user record
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert([{
      name: name || null,
      role: role || 'standard',
      enrolled_by: enrolled_by || null,
      active: true
    }])
    .select()
    .single();

  if (userError) return res.status(500).json({ error: userError.message });

  // Then link the fingerprint slot on the specific device to the user
  const { error: fpError } = await supabase
    .from('user_fingerprints')
    .insert([{
      user_id: userData.id,
      device_id,
      fingerprint_id,
      active: true
    }]);

  if (fpError) return res.status(500).json({ error: fpError.message });

  return res.status(200).json({ success: true, user_id: userData.id });
};