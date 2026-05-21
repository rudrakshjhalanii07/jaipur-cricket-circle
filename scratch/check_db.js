const SUPABASE_URL = "https://sogyuojtetdroxnvoulb.supabase.co";
const ANON_KEY = "sb_publishable_sJclB7WhFJ_zBVnjnz9dNA_iR_vBavN";

async function run() {
  const headers = {
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json"
  };

  console.log("=== FETCHING MATCHES ===");
  const matchesRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*&order=match_date.desc`, { headers });
  const matches = await matchesRes.json();
  console.log(JSON.stringify(matches, null, 2));

  console.log("\n=== FETCHING REGISTRATIONS ===");
  const regsRes = await fetch(`${SUPABASE_URL}/rest/v1/registrations?select=*`, { headers });
  const regs = await regsRes.json();
  console.log(JSON.stringify(regs, null, 2));

  console.log("\n=== FETCHING PLAYERS ===");
  const playersRes = await fetch(`${SUPABASE_URL}/rest/v1/players?select=*`, { headers });
  const players = await playersRes.json();
  console.log(JSON.stringify(players, null, 2));
}

run().catch(console.error);
