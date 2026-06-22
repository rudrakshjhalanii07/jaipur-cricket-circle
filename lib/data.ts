// ============================================================
// Jaipur Cricket Circle — Static Data Layer
// All dummy data for the MVP frontend
// ============================================================

// ----- Types -----

export type MemberTag =
  | "founding-member"
  | "captain"
  | "vice-captain"
  | "batter"
  | "bowler"
  | "all-rounder"
  | "wicketkeeper";

export type CricketRole =
  | "batter"
  | "bowler"
  | "all-rounder"
  | "wicketkeeper";

export interface Member {
  id: string;
  name: string;
  initials: string;
  image?: string;
  role: string; // Display role/title
  cricketRole: CricketRole;
  team: "Mavericks" | "NeuroStrikers" | "The Outliers" | "Unassigned";
  tags: MemberTag[];
  battingStyle: string;
  bowlingStyle: string;
  shortBio: string;
  joinedDate: string;
}

export interface ContentSection {
  type: "text" | "heading" | "image";
  content: string;
  caption?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  coverImage: string;
  contentSections: ContentSection[];
  date: string;
  author: string;
  readTime: string;
  tags: string[];
}

export interface MatchHistoryItem {
  id: string;
  date: string;
  type: "main" | "exhibition";
  team1: string; // Mavericks
  team1Score: string;
  team2: string; // NeuroStrikers
  team2Score: string;
  winner: "Mavericks" | "NeuroStrikers" | "Draw";
  result: string;
  summary: string;
  playerOfTheMatch: string;
  venue: string;
}

export interface Team {
  id: string;
  name: string;
  shortCode: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  mainSeriesWins: number;
  exhibitionSeriesWins: number;
}

export interface RegisteredPlayer {
  id: string;
  name: string;
  status: "registered" | "waitlist";
}

export interface RegistrationData {
  matchDate: string;
  matchDay: string;
  time: string;
  venue: string;
  venueAddress: string;
  locationMapUrl: string;
  playerLimit: number;
  registeredPlayers: RegisteredPlayer[];
  registrationStatus: "open" | "full" | "closed";
  rules: string[];
}

// ----- Helpers -----

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ----- Teams Data -----

export const teams: Record<string, Team> = {
  mavericks: {
    id: "t1",
    name: "Mavericks",
    shortCode: "MAV",
    logo: "M",
    primaryColor: "#3b82f6", // jcc-blue
    secondaryColor: "#60a5fa",
    mainSeriesWins: 10,
    exhibitionSeriesWins: 3,
  },
  neurostrikers: {
    id: "t2",
    name: "NeuroStrikers",
    shortCode: "NRS",
    logo: "N",
    primaryColor: "#ff4757", // jcc-red
    secondaryColor: "#ff6b7a",
    mainSeriesWins: 10,
    exhibitionSeriesWins: 1,
  },
};

// ----- Members Data -----

export const members: Member[] = [
  {
    id: "m1",
    name: "Opal Chaudhary",
    initials: getInitials("Opal Chaudhary"),
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&h=256&auto=format&fit=crop",
    role: "Founder & Captain",
    cricketRole: "all-rounder",
    team: "Mavericks",
    tags: ["founding-member", "captain", "all-rounder"],
    battingStyle: "Right-hand Bat",
    bowlingStyle: "Right-arm Medium",
    shortBio: "The strategic mind behind JCC. Opal founded the circle with a vision to bring quality community cricket to Jaipur.",
    joinedDate: "2026-01-01",
  },
  {
    id: "m2",
    name: "Nitin Setia",
    initials: getInitials("Nitin Setia"),
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&h=256&auto=format&fit=crop",
    role: "Co-founder & Captain",
    cricketRole: "batter",
    team: "NeuroStrikers",
    tags: ["founding-member", "captain", "batter"],
    battingStyle: "Right-hand Bat",
    bowlingStyle: "N/A",
    shortBio: "Leading NeuroStrikers with raw intensity. Nitin is known for his aggressive batting and tactical field placements.",
    joinedDate: "2026-01-01",
  },
  {
    id: "m3",
    name: "Sagar Sharma",
    initials: getInitials("Sagar Sharma"),
    role: "Founding Member & Vice Captain",
    cricketRole: "bowler",
    team: "Mavericks",
    tags: ["founding-member", "vice-captain", "bowler"],
    battingStyle: "Right-hand Bat",
    bowlingStyle: "Right-arm Fast",
    shortBio: "The reliable backbone of the Mavericks' bowling attack. Sagar has been instrumental in setting the standard for pace bowling in JCC.",
    joinedDate: "2026-01-01",
  },
  {
    id: "m4",
    name: "Abhijeet Singh Shekhawat",
    initials: getInitials("Abhijeet Singh Shekhawat"),
    role: "Founding Member",
    cricketRole: "all-rounder",
    team: "NeuroStrikers",
    tags: ["founding-member", "all-rounder"],
    battingStyle: "Left-hand Bat",
    bowlingStyle: "Right-arm Off-break",
    shortBio: "A flamboyant left-hander who brings flair to every Sunday. Abhijeet's off-spin often provides crucial breakthroughs.",
    joinedDate: "2026-01-01",
  },
  {
    id: "m5",
    name: "DJ Nitesh",
    initials: getInitials("DJ Nitesh"),
    role: "Founding Member",
    cricketRole: "wicketkeeper",
    team: "Mavericks",
    tags: ["founding-member", "wicketkeeper"],
    battingStyle: "Right-hand Bat",
    bowlingStyle: "N/A",
    shortBio: "High energy on and off the pitch. DJ is the life of the circle and a lightning-fast presence behind the stumps.",
    joinedDate: "2026-01-01",
  },
  {
    id: "m6",
    name: "Rohit Meena",
    initials: getInitials("Rohit Meena"),
    role: "Vice Captain",
    cricketRole: "bowler",
    team: "NeuroStrikers",
    tags: ["vice-captain", "bowler"],
    battingStyle: "Right-hand Bat",
    bowlingStyle: "Right-arm Medium Fast",
    shortBio: "A master of swing and seam. Rohit's ability to move the ball both ways makes him a nightmare for opening batters.",
    joinedDate: "2026-03-15",
  },
  {
    id: "m7",
    name: "Arjun Rathore",
    initials: getInitials("Arjun Rathore"),
    role: "Opening Batter",
    cricketRole: "batter",
    team: "Mavericks",
    tags: ["batter"],
    battingStyle: "Right-hand Bat",
    bowlingStyle: "N/A",
    shortBio: "Known for his explosive starts. Arjun doesn't believe in sighters; he believes in boundaries.",
    joinedDate: "2026-04-01",
  },
  {
    id: "m8",
    name: "Vikram Joshi",
    initials: getInitials("Vikram Joshi"),
    role: "Pace Specialist",
    cricketRole: "bowler",
    team: "NeuroStrikers",
    tags: ["bowler"],
    battingStyle: "Right-hand Bat",
    bowlingStyle: "Right-arm Fast",
    shortBio: "Raw pace and lethal yorkers. Vikram is the man Nitin turns to when a partnership needs breaking.",
    joinedDate: "2026-04-10",
  },
  {
    id: "m9",
    name: "Karan Patel",
    initials: getInitials("Karan Patel"),
    role: "Spin Wizard",
    cricketRole: "bowler",
    team: "Mavericks",
    tags: ["bowler"],
    battingStyle: "Right-hand Bat",
    bowlingStyle: "Right-arm Leg-break",
    shortBio: "The most successful spinner in JCC history. Karan's variations and control are second to none.",
    joinedDate: "2026-05-01",
  },
  {
    id: "m10",
    name: "Harsh Tanwar",
    initials: getInitials("Harsh Tanwar"),
    role: "Middle-order Anchor",
    cricketRole: "batter",
    team: "NeuroStrikers",
    tags: ["batter"],
    battingStyle: "Right-hand Bat",
    bowlingStyle: "N/A",
    shortBio: "Calm, composed, and clinical. Harsh is the anchor that allows the big hitters to play freely.",
    joinedDate: "2026-05-15",
  },
];

// ----- Blog Data -----

export const blogPosts: BlogPost[] = [
  {
    id: "b1",
    slug: "the-day-neurostrikers-claimed-the-lead",
    title: "The Day NeuroStrikers Claimed the Lead",
    category: "Match Report",
    excerpt: "A Sunday that shook the rivalry. NeuroStrikers pulled ahead 9-7 in a nail-biting finish.",
    coverImage: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=1200&h=600&auto=format&fit=crop",
    contentSections: [
      { type: "heading", content: "A High-Stakes Sunday" },
      { type: "text", content: "The atmosphere was electric from the first ball. With the series tied at 7-7, both teams knew this match would define the next few months of banter." },
      { type: "text", content: "Mavericks won the toss and elected to bat, posting a competitive 142/8. Arjun Rathore gave them a flying start with a quickfire 34." },
      { type: "image", content: "https://images.unsplash.com/photo-1540747913346-19e3ad6436b1?q=80&w=1200&h=600&auto=format&fit=crop", caption: "The sun rising over the SMS Stadium Ground B." },
      { type: "heading", content: "The Chase" },
      { type: "text", content: "NeuroStrikers' chase was anchored by Nitin Setia. His 45-run knock steadied the ship after two early wickets fell to Sagar Sharma's opening burst." },
      { type: "text", content: "In the end, it came down to 6 runs off the last over. Prateek Kulhari kept his cool and finished it with a boundary to claim the lead." },
    ],
    date: "2026-04-27",
    author: "Opal Chaudhary",
    readTime: "5 min read",
    tags: ["Match Report", "Rivalry"],
  },
  {
    id: "b2",
    slug: "mavericks-exhibition-dominance",
    title: "Mavericks' Exhibition Dominance: 3-1 and Counting",
    category: "Analysis",
    excerpt: "When the stakes are different, the Mavericks show a different gear.",
    coverImage: "https://images.unsplash.com/photo-1593341646782-e0b495cff86d?q=80&w=1200&h=600&auto=format&fit=crop",
    contentSections: [
      { type: "heading", content: "The Exhibition Mentality" },
      { type: "text", content: "While the main series is a grueling marathon, the exhibition matches allow for more experimentation. This is where the Mavericks have truly shone." },
      { type: "text", content: "With a 3-1 lead, the Mavericks have used these matches to test new bowling rotations and batting orders, often surprising the NeuroStrikers." },
    ],
    date: "2026-04-20",
    author: "Nitin Setia",
    readTime: "4 min read",
    tags: ["Exhibition", "Analysis"],
  },
  {
    id: "b3",
    slug: "how-jcc-started",
    title: "How It All Started: The Birth of Jaipur Cricket Circle",
    category: "Origin Story",
    excerpt: "Five friends, one WhatsApp group, and a dream to play cricket every Sunday.",
    coverImage: "https://images.unsplash.com/photo-1461896756913-647565801d1b?q=80&w=1200&h=600&auto=format&fit=crop",
    contentSections: [
      { type: "heading", content: "The First Message" },
      { type: "text", content: "It started with a simple 'Cricket this Sunday?' message in early 2026. Opal, Nitin, Sagar, Abhijeet, and DJ Nitesh were looking for a way to stay active and reconnect with the game they loved." },
      { type: "text", content: "What began as a one-off game at a local park soon became a weekly ritual. Word spread, and soon the 'Circle' began to form." },
    ],
    date: "2026-03-30",
    author: "DJ Nitesh",
    readTime: "8 min read",
    tags: ["Origin Story", "Culture"],
  },
];

// ----- Rivalry & Match History Data -----

export const matchHistory: MatchHistoryItem[] = [
  {
    id: "r-today-2",
    date: "2026-05-10",
    type: "main",
    team1: "Mavericks",
    team1Score: "168/4",
    team2: "NeuroStrikers",
    team2Score: "165/7",
    winner: "Mavericks",
    result: "Mavericks won by 3 runs",
    summary: "A thrilling double-header finish. Mavericks defended a tight total in the second match of the day to level the series.",
    playerOfTheMatch: "Arjun Rathore",
    venue: "SMS Stadium Ground B",
  },
  {
    id: "r-today-1",
    date: "2026-05-10",
    type: "main",
    team1: "Mavericks",
    team1Score: "145/2",
    team2: "NeuroStrikers",
    team2Score: "142/8",
    winner: "Mavericks",
    result: "Mavericks won by 8 wickets",
    summary: "Complete dominance in the first match of the day. Opal Chaudhary's bowling set the tone for a comfortable chase.",
    playerOfTheMatch: "Opal Chaudhary",
    venue: "SMS Stadium Ground B",
  },
  {
    id: "r1",
    date: "2026-04-27",
    type: "main",
    team1: "Mavericks",
    team1Score: "142/8",
    team2: "NeuroStrikers",
    team2Score: "145/6",
    winner: "NeuroStrikers",
    result: "NeuroStrikers won by 4 wickets",
    summary: "A high-intensity clash for the series lead. Nitin Setia's anchor innings ensured a calm finish for the Strikers.",
    playerOfTheMatch: "Nitin Setia",
    venue: "SMS Stadium Ground B",
  },
  {
    id: "r2",
    date: "2026-04-20",
    type: "exhibition",
    team1: "Mavericks",
    team1Score: "131/4",
    team2: "NeuroStrikers",
    team2Score: "128/10",
    winner: "Mavericks",
    result: "Mavericks won by 6 wickets",
    summary: "Mavericks' bowlers dominated from the start, bowling out the Strikers for 128. The chase was clinical.",
    playerOfTheMatch: "Opal Chaudhary",
    venue: "Sawai Mansingh Ground",
  },
  {
    id: "r3",
    date: "2026-04-13",
    type: "main",
    team1: "Mavericks",
    team1Score: "155/7",
    team2: "NeuroStrikers",
    team2Score: "158/5",
    winner: "NeuroStrikers",
    result: "NeuroStrikers won by 5 wickets",
    summary: "Prateek Kulhari's explosive 40 at the death snatched victory from the jaws of defeat for the Strikers.",
    playerOfTheMatch: "Prateek Kulhari",
    venue: "Central Park Cricket Ground",
  },
  {
    id: "r4",
    date: "2026-04-06",
    type: "main",
    team1: "Mavericks",
    team1Score: "130/10",
    team2: "NeuroStrikers",
    team2Score: "134/9",
    winner: "NeuroStrikers",
    result: "NeuroStrikers won by 4 runs",
    summary: "A low-scoring thriller. Vikram Joshi's final over conceded only 3 runs, defending 8 to win.",
    playerOfTheMatch: "Vikram Joshi",
    venue: "SMS Stadium Ground B",
  },
  {
    id: "r5",
    date: "2026-03-30",
    type: "exhibition",
    team1: "Mavericks",
    team1Score: "167/5",
    team2: "NeuroStrikers",
    team2Score: "152/8",
    winner: "Mavericks",
    result: "Mavericks won by 15 runs",
    summary: "Arjun Rathore's century (the first in JCC history) powered the Mavericks to a massive total.",
    playerOfTheMatch: "Arjun Rathore",
    venue: "Sawai Mansingh Ground",
  },
];

// Calculate Dynamic Rivalry Data
const baseStats = {
  main: { mavericks: 8, neuroStrikers: 7 }, // Base before matchHistory items
  exhibition: { mavericks: 1, neuroStrikers: 1 },
  totalMatchesBase: 17
};

export const rivalryData = {
  mainSeries: {
    mavericks: baseStats.main.mavericks + matchHistory.filter(m => m.type === 'main' && m.winner === 'Mavericks').length,
    neuroStrikers: baseStats.main.neuroStrikers + matchHistory.filter(m => m.type === 'main' && m.winner === 'NeuroStrikers').length,
  },
  exhibitionSeries: {
    mavericks: baseStats.exhibition.mavericks + matchHistory.filter(m => m.type === 'exhibition' && m.winner === 'Mavericks').length,
    neuroStrikers: baseStats.exhibition.neuroStrikers + matchHistory.filter(m => m.type === 'exhibition' && m.winner === 'NeuroStrikers').length,
  },
  get totalMatches() {
    return baseStats.totalMatchesBase + matchHistory.length;
  },
  get recentMatches() {
    return matchHistory.slice(0, 5);
  }
};

// ----- Registration Data -----

export const registrationData: RegistrationData = {
  matchDate: "2026-05-11",
  matchDay: "Sunday",
  time: "6:00 AM — 9:00 AM",
  venue: "SMS Stadium Ground B",
  venueAddress: "SMS Stadium, Jawaharlal Nehru Marg, Jaipur, Rajasthan 302004",
  locationMapUrl: "https://maps.google.com/?q=Sawai+Mansingh+Stadium",
  playerLimit: 18,
  registrationStatus: "full",
  registeredPlayers: [
    { id: "rp1", name: "Opal Chaudhary", status: "registered" },
    { id: "rp2", name: "Nitin Setia", status: "registered" },
    { id: "rp3", name: "Sagar Sharma", status: "registered" },
    { id: "rp4", name: "Abhijeet Singh Shekhawat", status: "registered" },
    { id: "rp5", name: "DJ Nitesh", status: "registered" },
    { id: "rp6", name: "Rohit Meena", status: "registered" },
    { id: "rp7", name: "Arjun Rathore", status: "registered" },
    { id: "rp8", name: "Vikram Joshi", status: "registered" },
    { id: "rp9", name: "Karan Patel", status: "registered" },
    { id: "rp10", name: "Harsh Tanwar", status: "registered" },
    { id: "rp11", name: "Deepak Saini", status: "registered" },
    { id: "rp12", name: "Manish Yadav", status: "registered" },
    { id: "rp13", name: "Prateek Kulhari", status: "registered" },
    { id: "rp14", name: "Rajat Choudhary", status: "registered" },
    { id: "rp15", name: "Aditya Verma", status: "registered" },
    { id: "rp16", name: "Sahil Bhatt", status: "waitlist" },
    { id: "rp17", name: "Yash Goyal", status: "waitlist" },
    { id: "rp18", name: "Tarun Kapoor", status: "waitlist" },
  ],
  rules: [
    "Arrive 15 minutes before match time for warm-up.",
    "Wear proper cricket attire and sports shoes.",
    "Helmet is mandatory for batting (provided on ground).",
    "Respect the umpire's decision — no arguments.",
    "No sledging or unsportsmanlike behavior.",
    "Confirm your attendance by Saturday 8 PM.",
    "If you can't make it, inform the group so waitlisted players can join.",
    "Stay hydrated — carry your own water bottle.",
  ],
};

// ----- About / Stats Data -----

export const clubStats = {
  founded: "2026",
  totalMembers: 11,
  matchesPlayed: 26,  // Sum of all rivalry_seasons.total_matches_played (24 archived + 2 active)
  sundaysActive: 52,
  citiesRepresented: 1,
  tagline: "Where Sundays Hit Different",
  mission:
    "Jaipur Cricket Circle is more than a cricket group — it's a brotherhood built on Sunday mornings, competitive spirit, and the love of the game. What started as five friends looking for a regular game has grown into Jaipur's most spirited community cricket circle.",
  chewvanaTimesDescription:
    "Chewvana Times is our weekly blog and match report — part journalism, part banter, all heart. Every Sunday's drama, every rivalry twist, and every memorable moment gets captured in the pages of the Chewvana Times.",
};
