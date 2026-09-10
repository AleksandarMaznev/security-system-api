const supabase = require('./_supabase');

async function sendPushToAdmins(title, body) {
  const { data, error } = await supabase
    .from('admin_credentials')
    .select('push_token, users(role, active)')
    .not('push_token', 'is', null);

  if (error || !data) return;

  const tokens = data
    .filter((row) => row.users?.active && row.users?.role === 'admin')
    .map((row) => row.push_token);

  if (tokens.length === 0) return;

  await Promise.allSettled(
    tokens.map((to) =>
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, title, body, sound: 'default' }),
      })
    )
  );
}

module.exports = { sendPushToAdmins };