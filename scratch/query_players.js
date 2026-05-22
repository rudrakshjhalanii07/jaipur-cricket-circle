const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const supabaseAnonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim().replace(/['"]/g, '');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: players, error } = await supabase
    .from('players')
    .select('name, approval_status, is_active');
  
  if (error) {
    console.error("Error fetching players:", error);
    return;
  }
  
  console.log("Total players in DB:", players.length);
  const approvedActive = players.filter(p => p.approval_status === 'approved' && p.is_active === true);
  console.log("Approved and active players in DB:", approvedActive.length);
  console.log("Approved and active players list:", approvedActive.map(p => p.name));
}

run();
