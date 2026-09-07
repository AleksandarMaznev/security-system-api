const supabase = require('./_supabase');

// POST /api/log
//
// Shape 1: { fingerprint_id, device_id, result, role_at_time }
// Shape 2: { device_id, logs: [{ fingerprint_id, result, role_at_time?,
//                                       idempotency_key, event_time? }, ...] }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};

  // --- Batch shape: presence of a top-level "logs" array selects it ---
  if (Array.isArray(body.logs)) {
    const { device_id, logs } = body;
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });
    if (logs.length === 0) return res.status(400).json({ error: 'logs must be a non-empty array' });
    if (logs.length > 500) return res.status(400).json({ error: 'logs exceeds the max batch size of 500' });

    const rows = [];
    for (const entry of logs) {
      const { fingerprint_id, result, role_at_time, idempotency_key, event_time } = entry || {};
      if (!fingerprint_id || !result || !idempotency_key) {
        return res.status(400).json({
          error: 'each log entry requires fingerprint_id, result, and idempotency_key',
        });
      }
      rows.push({
        device_id,
        fingerprint_id,
        result,
        role_at_time: role_at_time || null,
        idempotency_key,
        timestamp: event_time || new Date().toISOString(),
      });
    }

    const submittedKeys = rows.map((r) => r.idempotency_key);

    const { error: upsertError } = await supabase
      .from('access_logs')
      .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if (upsertError) return res.status(500).json({ error: upsertError.message });

    // Re-select rather than trust the upsert's own return: duplicates
    // skipped by ignoreDuplicates don't come back in the result, but
    // they're just as "safe to drop locally" as a fresh insert.
    const { data: confirmed, error: selectError } = await supabase
      .from('access_logs')
      .select('idempotency_key')
      .in('idempotency_key', submittedKeys);
    if (selectError) return res.status(500).json({ error: selectError.message });

    await supabase
      .from('devices')
      .upsert({ device_id, last_seen: new Date().toISOString(), status: 'online' }, { onConflict: 'device_id' });

    const accepted = (confirmed ?? []).map((r) => r.idempotency_key);
    return res.status(200).json({ success: true, accepted });
  }

  // --- Original single-event shape, unchanged ---
  const { fingerprint_id, device_id, result, role_at_time } = body;
  if (!fingerprint_id || !device_id || !result) {
    return res.status(400).json({ error: 'fingerprint_id, device_id and result are required' });
  }

  const { error: logError } = await supabase
    .from('access_logs')
    .insert([{ fingerprint_id, device_id, result, role_at_time }]);
  if (logError) return res.status(500).json({ error: logError.message });

  const { error: deviceError } = await supabase
    .from('devices')
    .update({ last_seen: new Date().toISOString() })
    .eq('device_id', device_id);
  if (deviceError) return res.status(500).json({ error: deviceError.message });

  return res.status(200).json({ success: true });
};