const supabase = require('../_supabase');
const { requireAdmin } = require('./_auth');

// GET  /api/mobile/commands  — unchanged from before.
// POST /api/mobile/commands  — NEW. Issues a command to a device.
//
const KNOWN_COMMANDS = [
  'enroll_fingerprint', 'delete_fingerprint', 'delete_all',
  'set_role', 'reboot', 'sync_slots', 'set_config',
];

module.exports = async (req, res) => {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const { device_id, status, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('command_queue')
      .select('*')
      .order('issued_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (device_id) query = query.eq('device_id', device_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ commands: data });
  }

  if (req.method === 'POST') {
    const { device_id, command, payload, valid_seconds } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });
    if (!command) return res.status(400).json({ error: 'command is required' });
    if (!KNOWN_COMMANDS.includes(command)) {
      return res.status(400).json({ error: `command must be one of: ${KNOWN_COMMANDS.join(', ')}` });
    }

    const issuedAt = new Date();
    const validUntil = new Date(issuedAt.getTime() + (Number(valid_seconds) || 300) * 1000);

    const { data, error } = await supabase
      .from('command_queue')
      .insert([{
        device_id,
        command,
        payload: payload ?? null,
        status: 'pending',
        issued_at: issuedAt.toISOString(),
        valid_until: validUntil.toISOString(),
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true, command: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};