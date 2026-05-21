const SUPABASE_URL = "https://sogyuojtetdroxnvoulb.supabase.co";
const ANON_KEY = "sb_publishable_sJclB7WhFJ_zBVnjnz9dNA_iR_vBavN";

async function run() {
  const headers = {
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json"
  };

  // 1. Get the match
  const matchesRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*&order=match_date.desc`, { headers });
  const matches = await matchesRes.json();
  const match = matches[0];
  if (!match) {
    console.error("No match found");
    return;
  }
  console.log("Using Match:", match.id, match.match_date);

  // 2. Get the player
  const playersRes = await fetch(`${SUPABASE_URL}/rest/v1/players?phone=eq.8058364186`, { headers });
  const players = await playersRes.json();
  const player = players[0];
  if (!player) {
    console.error("Player not found");
    return;
  }
  console.log("Using Player:", player.id, player.name);

  // 3. Register player
  const regPayload = {
    match_id: match.id,
    player_id: player.id,
    name: player.name,
    phone: player.phone,
    cricket_role: player.cricket_role,
    status: "confirmed"
  };

  const regRes = await fetch(`${SUPABASE_URL}/rest/v1/registrations`, {
    method: "POST",
    headers,
    body: JSON.stringify(regPayload)
  });

  if (regRes.ok) {
    console.log("Successfully registered player!");
  } else {
    console.error("Failed to register player:", await regRes.text());
  }
}

run().catch(console.error);
