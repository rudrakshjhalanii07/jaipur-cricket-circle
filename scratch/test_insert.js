const SUPABASE_URL = "https://sogyuojtetdroxnvoulb.supabase.co";
const ANON_KEY = "sb_publishable_sJclB7WhFJ_zBVnjnz9dNA_iR_vBavN";

async function run() {
  const headers = {
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json"
  };

  // Let's get match and player
  const matchesRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*&order=match_date.desc`, { headers });
  const matches = await matchesRes.json();
  const match = matches[0];

  const playersRes = await fetch(`${SUPABASE_URL}/rest/v1/players?phone=eq.8058364186`, { headers });
  const players = await playersRes.json();
  const player = players[0];

  // Try insert without status (using default)
  const regPayload = {
    match_id: match.id,
    player_id: player.id,
    name: player.name,
    phone: player.phone,
    cricket_role: player.cricket_role
  };

  console.log("Inserting with payload:", regPayload);
  const regRes = await fetch(`${SUPABASE_URL}/rest/v1/registrations`, {
    method: "POST",
    headers,
    body: JSON.stringify(regPayload)
  });

  console.log("Status:", regRes.status);
  console.log("Response text:", await regRes.text());
}

run().catch(console.error);
