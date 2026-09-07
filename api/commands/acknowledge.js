const supabase = require('../_supabase');

// POST /api/commands/acknowledge
// Auth: x-api-key
// Body: { command_id, status?, error?, result? }
const VALID_STATUSES = ['acknowledged', 'failed', 'expired'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { command_id, status, error: cmdError, result } = req.body || {};
  if (!command_id) return res.status(400).json({ error: 'command_id is required' });

  const finalStatus = status || 'acknowledged';
  if (!VALID_STATUSES.includes(finalStatus)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const update = {
    status: finalStatus,
    acknowledged_at: new Date().toISOString(),
  };
  // NOTE: error/result columns are new — see migration.sql. If that
  // migration hasn't been applied yet, drop these two lines rather than
  // fail every acknowledgement outright.
  if (cmdError) update.error = String(cmdError);
  if (result) update.result = result;

  const { error } = await supabase
    .from('command_queue')
    .update(update)
    .eq('id', command_id)
    .eq('status', 'pending');

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true });
};