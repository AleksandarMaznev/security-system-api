const bcrypt = require('bcryptjs');
const supabase = require('../_supabase');
const { requireAdmin } = require('./_auth');

const VALID_ACTIONS = ['promote', 'demote', 'delete'];

// Alphanumeric only, no ambiguous chars (0/O, 1/I/l)
const PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';

function generatePassword() {
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)];
  }
  return password;
}

async function generateUsername(name) {
  const base = (name || 'user').toLowerCase().replace(/\s+/g, '');

  // Check if base username is taken
  const { data } = await supabase
    .from('admin_credentials')
    .select('username')
    .like('username', `${base}%`);

  const existing = new Set((data || []).map(r => r.username));

  if (!existing.has(base)) return base;

  let i = 1;
  while (existing.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id, action } = req.body;

  if (!id) return res.status(400).json({ error: 'id is required' });
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }

  // Get all devices this user has active fingerprints on
  const { data: fingerprints, error: fpError } = await supabase
    .from('user_fingerprints')
    .select('device_id, fingerprint_id')
    .eq('user_id', id)
    .eq('active', true);

  if (fpError) return res.status(500).json({ error: fpError.message });
  if (!fingerprints || fingerprints.length === 0) {
    return res.status(404).json({ error: 'No active fingerprints found for this user' });
  }

  if (action === 'promote' || action === 'demote') {
    const newRole = action === 'promote' ? 'admin' : 'standard';
    const command = action === 'promote' ? 'promote_to_admin' : 'demote_to_user';

    const { error: userError } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', id);

    if (userError) return res.status(500).json({ error: userError.message });

    let generatedCredentials = null;

    if (action === 'promote') {
      // Fetch user's name to build username
      const { data: userData, error: userFetchError } = await supabase
        .from('users')
        .select('name')
        .eq('id', id)
        .single();

      if (userFetchError) return res.status(500).json({ error: userFetchError.message });

      const username = await generateUsername(userData.name);
      const password = generatePassword();
      const password_hash = await bcrypt.hash(password, 10);

      const { error: credError } = await supabase
        .from('admin_credentials')
        .insert([{ user_id: id, username, password_hash }]);

      if (credError) return res.status(500).json({ error: credError.message });

      generatedCredentials = { username, password };

    } else if (action === 'demote') {
      const { error: credError } = await supabase
        .from('admin_credentials')
        .delete()
        .eq('user_id', id);

      if (credError) return res.status(500).json({ error: credError.message });
    }

    const commands = fingerprints.map(fp => ({
      device_id: fp.device_id,
      command,
      payload: { fingerprint_id: fp.fingerprint_id },
      valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }));

    const { error: cmdError } = await supabase.from('command_queue').insert(commands);
    if (cmdError) return res.status(500).json({ error: cmdError.message });

    return res.status(200).json({
      success: true,
      devices_notified: fingerprints.length,
      ...(generatedCredentials && { credentials: generatedCredentials }),
    });

  } else if (action === 'delete') {
    const { error: fpUpdateError } = await supabase
      .from('user_fingerprints')
      .update({ active: false, fingerprint_id: null })
      .eq('user_id', id)
      .eq('active', true);

    if (fpUpdateError) return res.status(500).json({ error: fpUpdateError.message });

    const { error: userError } = await supabase
      .from('users')
      .update({ active: false })
      .eq('id', id);

    if (userError) return res.status(500).json({ error: userError.message });

    const commands = fingerprints.map(fp => ({
      device_id: fp.device_id,
      command: 'delete_user',
      payload: { fingerprint_id: fp.fingerprint_id },
      valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }));

    const { error: cmdError } = await supabase.from('command_queue').insert(commands);
    if (cmdError) return res.status(500).json({ error: cmdError.message });
  }

  return res.status(200).json({ success: true, devices_notified: fingerprints.length });
};
