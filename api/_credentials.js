const supabase = require('./_supabase');

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

  const { data } = await supabase
    .from('admin_credentials')
    .select('username')
    .like('username', `${base}%`);

  const existing = new Set((data || []).map((r) => r.username));

  if (!existing.has(base)) return base;

  let i = 1;
  while (existing.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

module.exports = { generatePassword, generateUsername };