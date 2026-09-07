const supabase = require('../_supabase');

// POST /api/logs/batch
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-api-key'] !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { device_id, logs } = req.body || {};
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });
  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: 'logs must be a non-empty array' });
  }
  if (logs.length > 500) {
    return res.status(400).json({ error: 'logs exceeds the max batch size of 500' });
  }

  const rows = [];
  for (const entry of logs || []) {
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
      // Preserve the event's real time if the device supplied one
      // (post-SNTP-sync wall clock, or reconciled after the fact) rather
      // than defaulting to "whenever this batch happened to upload".
      timestamp: event_time || new Date().toISOString(),
    });
  }

  const submittedKeys = rows.map((r) => r.idempotency_key);

  const { error: upsertError } = await supabase
    .from('access_logs')
    .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true });

  if (upsertError) return res.status(500).json({ error: upsertError.message });

  // Re-select rather than trust the upsert's own return value: rows
  // skipped as duplicates (already stored from a previous attempt at
  // this batch) don't come back from an ignoreDuplicates upsert, but
  // they're still exactly as "safe to drop" as ones inserted just now.
  const { data: confirmed, error: selectError } = await supabase
    .from('access_logs')
    .select('idempotency_key')
    .in('idempotency_key', submittedKeys);

  if (selectError) return res.status(500).json({ error: selectError.message });

  await supabase
    .from('devices')
    .upsert(
      { device_id, last_seen: new Date().toISOString(), status: 'online' },
      { onConflict: 'device_id' }
    );

  const accepted = (confirmed ?? []).map((r) => r.idempotency_key);
  return res.status(200).json({ success: true, accepted });
};