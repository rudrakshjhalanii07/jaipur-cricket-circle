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
  const { data: players, error: pError } = await supabase
    .from('players')
    .select('id, name, approval_status, is_active');
  
  if (pError) console.error("Error players:", pError);
  
  const { count: matchesCount, error: mError } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true });

  if (mError) console.error("Error matches:", mError);

  // Fetch total matches played across ALL rivalry seasons combined
  const { data: rivalrySeasons, error: rsError } = await supabase
    .from('rivalry_seasons')
    .select('title, status, total_matches_played');

  if (rsError) console.error("Error rivalry_seasons:", rsError);

  const totalMatchesAllSeasons = rivalrySeasons
    ? rivalrySeasons.reduce((sum, s) => sum + (s.total_matches_played || 0), 0)
    : 0;

  const approvedActive = players?.filter(p => p.approval_status === 'approved' && p.is_active === true) || [];

  console.log("=== DB Stats ===");
  console.log("Total players:", players?.length || 0);
  console.log("Approved & Active players:", approvedActive.length);
  console.log("Matches Count in DB (matches table):", matchesCount);
  console.log("\n=== Rivalry Seasons ===");
  rivalrySeasons?.forEach(s => {
    console.log(`  [${s.status.toUpperCase()}] ${s.title}: ${s.total_matches_played} matches`);
  });
  console.log(`\nTotal matches played (all rivalry seasons combined): ${totalMatchesAllSeasons}`);
  console.log("\n=== Site-wide Stats Summary ===");
  console.log(`Active Members  : ${approvedActive.length}+`);
  console.log(`Matches Played  : ${totalMatchesAllSeasons}+`);
}

run();
