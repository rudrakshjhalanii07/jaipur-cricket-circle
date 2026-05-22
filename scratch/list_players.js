const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('approval_status', 'approved');

  if (error) {
    console.error('Error fetching players:', error);
    process.exit(1);
  }

  console.log('--- APPROVED PLAYERS ---');
  data.forEach(p => {
    console.log(`ID: ${p.id} | Name: ${p.name} | Role: ${p.cricket_role} | Tag: ${p.member_tag} | GroupRole: ${p.group_role}`);
  });
}

listPlayers();
