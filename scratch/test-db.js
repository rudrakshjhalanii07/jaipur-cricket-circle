const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local manually
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Querying players with select(*)");
  try {
    const { data, error } = await supabaseAdmin
      .from("players")
      .select("*")
      .limit(1);
    
    if (error) {
      console.error("Select * Error:", error);
    } else {
      console.log("Columns present in players table:");
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
      } else {
        console.log("No data returned, table might be empty");
      }
    }
  } catch (err) {
    console.error("Exception:", err);
  }
}

run();
