// Randomly allocates the given players into 4 teams in a 3:3:2:2 ratio.
// Usage: node scripts/allocate-players.mjs

const players = [
  "Aditya Maroo",
  "Devam",
  "Karandeep",
  "Raghav",
  "Rahul Krishnani",
  "Yuvraj Pareek",
  "Sameer Saifi",
  "Gaurang",
  "Madhav",
  "Sarthak",
];

const teamNames = ["Neurostrikers", "Mavericks", "Outliers", "Vikings"];
const teamSizes = [3, 3, 2, 2];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const shuffled = shuffle(players);
const shuffledNames = shuffle(teamNames);

let cursor = 0;
const teams = teamSizes.map((size, idx) => {
  const members = shuffled.slice(cursor, cursor + size);
  cursor += size;
  return { name: shuffledNames[idx], members };
});

for (const team of teams) {
  console.log(`${team.name} (${team.members.length}):`);
  for (const member of team.members) {
    console.log(`  - ${member}`);
  }
}
