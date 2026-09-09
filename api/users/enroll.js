const bcrypt = require('bcryptjs');
const supabase = require('../_supabase');
const { generatePassword, generateUsername } = require('../_credentials');

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

  // Admin enrollments — critically, the device-side bootstrap path,
  // which has no existing admin session to promote them from — need a
  // login the mobile app will accept. Without this, a device-enrolled
  // admin could unlock the door forever but never once log into the
  // app, since login.js only checks admin_credentials, and nothing else
  // in this endpoint ever wrote a row there. Same generator as the
  // mobile app's own 'promote' action, not a separate, weaker one.
  let credentials = null;
  if ((role || 'standard') === 'admin') {
    const username = await generateUsername(userData.name);
    const password = generatePassword();
    const password_hash = await bcrypt.hash(password, 10);

    const { error: credError } = await supabase
      .from('admin_credentials')
      .insert([{ user_id: userData.id, username, password_hash }]);

    if (credError) return res.status(500).json({ error: credError.message });

    // Returned in plaintext exactly once — it's hashed above and cannot
    // be retrieved again after this response. The only display available
    // at device-bootstrap time is the device's own screen, so this has
    // to reach the firmware over the wire, not just an app session.
    credentials = { username, password };
  }

  return res.status(200).json({
    success: true,
    user_id: userData.id,
    ...(credentials && { credentials }),
  });
};