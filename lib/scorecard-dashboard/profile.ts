// Player flash cards and league insights, computed in the browser from the
// row-level data built by buildCardData() in compute.ts.
//
// Nothing here imports the scorecard JSON, so the stats page ships only the
// resolved rows, not the raw export. The export has no ball-by-ball data:
// anything that pairs one bowler with one batter compares the innings where
// both played, and every card that does so says so.
//
// Rankings follow the IPL convention used sitewide (see lib/series.ts):
// batting runs → strike rate → average, bowling wickets → economy → runs.

export type CardKind = "no" | "c" | "cb" | "st" | "lbw" | "b" | "ro" | "hw" | "rt" | "ot";

export type CardMatch = {
  /** CricHeroes match ID. */
  id: string;
  season: number;
  date: string;
  venue: string;
  overs: number;
  teamA: string;
  teamB: string;
  winner: string | null;
  winBy: string;
};

/** match, inning, player, team, opponent, runs, balls, 4s, 6s, kind, bowler,
 *  fielders, keeper took it (0/1), batting position, fall of wicket, how out */
export type BatTuple = [
  number, number, number, string, string,
  number, number, number, number,
  CardKind, number, number[], 0 | 1, number,
  [number, number, string] | null,
  string,
];
/** match, inning, player, team, opponent, balls, maidens, runs, wickets, dots, wides, no-balls */
export type BowlTuple = [number, number, number, string, string, number, number, number, number, number, number, number];
/** match, inning, team, runs, wickets, balls, extras */
export type InningsTuple = [number, number, string, number, number, number, number];

export type CardData = {
  players: string[];
  playerIds: string[];
  matches: CardMatch[];
  innings: InningsTuple[];
  bat: BatTuple[];
  bowl: BowlTuple[];
  /** match, player, team: every name that appears anywhere on a scorecard. */
  present: [number, number, string][];
};

export type Bat = {
  m: number; inn: number; p: number; team: string; opp: string;
  runs: number; balls: number; f4: number; s6: number;
  kind: CardKind; bw: number; fl: number[]; keeper: boolean; pos: number;
  fow: [number, number, string] | null; how: string;
};
export type Bowl = {
  m: number; inn: number; p: number; team: string; opp: string;
  balls: number; mdn: number; runs: number; wk: number; dots: number; wd: number; nb: number;
};

// ─── Formatting ──────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
export const f0 = (x: number | null) => (x == null || !isFinite(x) ? "–" : String(Math.round(x)));
export const f1 = (x: number | null) => (x == null || !isFinite(x) ? "–" : x.toFixed(1));
export const f2 = (x: number | null) => (x == null || !isFinite(x) ? "–" : x.toFixed(2));
export const ov = (balls: number) => (balls % 6 ? `${Math.floor(balls / 6)}.${balls % 6}` : `${balls / 6}`);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pct = (a: number, b: number) => (b ? (100 * a) / b : null);
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >> 3) ^ 1 && n % 10] || "th"}`;

export const KIND_LABEL: Record<CardKind, string> = {
  no: "Not out", c: "Caught", cb: "Caught & bowled", st: "Stumped", lbw: "LBW", b: "Bowled",
  ro: "Run out", hw: "Hit wicket", rt: "Retired out", ot: "Other",
};
const KIND_ORDER: CardKind[] = ["c", "cb", "b", "lbw", "st", "ro", "rt"];
const isOut = (k: CardKind) => k !== "no";

export type DuckType = "diamond" | "platinum" | "golden" | "silver" | "bronze" | "regular";
export const DUCKS: { key: DuckType; label: string; rule: string }[] = [
  { key: "diamond", label: "Diamond", rule: "Out without facing a ball" },
  { key: "platinum", label: "Platinum", rule: "Out to the first ball of the innings" },
  { key: "golden", label: "Golden", rule: "Out first ball" },
  { key: "silver", label: "Silver", rule: "Out second ball" },
  { key: "bronze", label: "Bronze", rule: "Out third ball" },
  { key: "regular", label: "Duck", rule: "Out for 0 after 4+ balls" },
];
export function duckType(r: Bat): DuckType | null {
  if (!isOut(r.kind) || r.kind === "rt" || r.runs !== 0) return null;
  if (r.balls === 0) return "diamond";
  if (r.balls === 1) return r.fow && r.fow[2] === "0.1" ? "platinum" : "golden";
  if (r.balls === 2) return "silver";
  if (r.balls === 3) return "bronze";
  return "regular";
}
/** Which phase of the innings a wicket fell in, from the fall-of-wicket over. */
export type Phase = "powerplay" | "middle" | "death";
export function wicketPhase(r: Bat, overs: number): Phase | null {
  if (!r.fow) return null;
  const [o, b = "0"] = r.fow[2].split(".");
  const ball = Number(o) * 6 + Number(b);
  if (!ball) return null;
  const over = Math.ceil(ball / 6);
  return over <= 2 ? "powerplay" : over > overs - 2 ? "death" : "middle";
}

/** A guaranteed floor: every non-boundary run counted as a single. */
const minDots = (r: Bat) => Math.max(0, r.balls - r.f4 - r.s6 - Math.max(0, r.runs - 4 * r.f4 - 6 * r.s6));

// ─── Aggregates ──────────────────────────────────────────────────────────────

export type BatAgg = ReturnType<typeof aggBat>;
export function aggBat(rows: Bat[]) {
  let no = 0, outs = 0, runs = 0, balls = 0, f4 = 0, s6 = 0, ducks = 0, t20 = 0, t30 = 0, t50 = 0, dots = 0;
  let hs = -1, hsNO = false;
  const kinds: Partial<Record<CardKind, number>> = {};
  for (const r of rows) {
    runs += r.runs; balls += r.balls; f4 += r.f4; s6 += r.s6; dots += minDots(r);
    if (isOut(r.kind)) { outs++; kinds[r.kind] = (kinds[r.kind] ?? 0) + 1; } else no++;
    if (r.runs > hs || (r.runs === hs && !isOut(r.kind))) { hs = r.runs; hsNO = !isOut(r.kind); }
    if (duckType(r)) ducks++;
    if (r.runs >= 20) t20++;
    if (r.runs >= 30) t30++;
    if (r.runs >= 50) t50++;
  }
  const bnd = f4 + s6, bndRuns = 4 * f4 + 6 * s6;
  return {
    inns: rows.length, no, outs, runs, balls, f4, s6, ducks, t20, t30, t50, dots, kinds,
    hs: hs < 0 ? "–" : `${hs}${hsNO ? "*" : ""}`,
    sr: balls ? (100 * runs) / balls : null,
    avg: outs ? runs / outs : null,
    bpb: bnd ? balls / bnd : null,
    six100: balls ? (100 * s6) / balls : null,
    bndPct: runs ? (100 * bndRuns) / runs : null,
    nbSR: balls - bnd > 0 ? (100 * (runs - bndRuns)) / (balls - bnd) : null,
    dotPct: balls ? (100 * dots) / balls : null,
    bpd: outs ? balls / outs : null,
  };
}

export type BowlAgg = ReturnType<typeof aggBowl>;
export function aggBowl(rows: Bowl[]) {
  let balls = 0, runs = 0, wk = 0, dots = 0, wd = 0, nb = 0, mdn = 0, hauls2 = 0, big = 0;
  let best: Bowl | null = null;
  for (const r of rows) {
    balls += r.balls; runs += r.runs; wk += r.wk; dots += r.dots; wd += r.wd; nb += r.nb; mdn += r.mdn;
    if (r.wk >= 2) hauls2++;
    if (r.runs >= 20) big++;
    if (!best || r.wk > best.wk || (r.wk === best.wk && r.runs < best.runs)) best = r;
  }
  return {
    spells: rows.length, balls, runs, wk, dots, wd, nb, mdn, hauls2, big,
    best: best ? `${best.wk}/${best.runs}` : "–",
    econ: balls ? (6 * runs) / balls : null,
    avg: wk ? runs / wk : null,
    sr: wk ? balls / wk : null,
    dotPct: balls ? (100 * dots) / balls : null,
    wdo: balls ? (6 * wd) / balls : null,
  };
}

// ─── Scope index ─────────────────────────────────────────────────────────────

export type PlayerAgg = {
  p: number;
  bat: Bat[];
  bowl: Bowl[];
  field: Bat[];
  victims: Bat[];
  B: BatAgg;
  W: BowlAgg;
  F: { c: number; kc: number; st: number; ro: number; total: number };
  teams: string[];
  team: string;
  matches: number;
  matchIds: Set<number>;
  /** The side he turned out for in each match he played. */
  matchTeam: Map<number, string>;
  role: "Batter" | "Bowler" | "All-rounder" | "Fielder";
  /** Wickets taken in the first 2 overs, the middle, and the last 2 overs. */
  phase: Record<Phase, number>;
  /** His team's win % in the matches he played. */
  winPct: number;
};

type Rank = { rank: number; of: number };
export type ScopeIndex = ReturnType<typeof buildScope>;

const decoded = new WeakMap<CardData, { bat: Bat[]; bowl: Bowl[] }>();
function decode(d: CardData) {
  let x = decoded.get(d);
  if (!x) {
    x = {
      bat: d.bat.map((r) => ({
        m: r[0], inn: r[1], p: r[2], team: r[3], opp: r[4], runs: r[5], balls: r[6], f4: r[7], s6: r[8],
        kind: r[9], bw: r[10], fl: r[11], keeper: r[12] === 1, pos: r[13], fow: r[14], how: r[15],
      })),
      bowl: d.bowl.map((r) => ({
        m: r[0], inn: r[1], p: r[2], team: r[3], opp: r[4], balls: r[5], mdn: r[6], runs: r[7], wk: r[8],
        dots: r[9], wd: r[10], nb: r[11],
      })),
    };
    decoded.set(d, x);
  }
  return x;
}

export const MIN_BALLS = 30;
const key = (m: number, inn: number) => m * 10 + inn;

const scopes = new WeakMap<CardData, Map<string, ScopeIndex>>();
export function getScope(d: CardData, seasons: number[]): ScopeIndex {
  const k = seasons.join(",");
  const byData = scopes.get(d) ?? scopes.set(d, new Map()).get(d)!;
  return byData.get(k) ?? byData.set(k, buildScope(d, seasons)).get(k)!;
}

function buildScope(d: CardData, seasons: number[]) {
  const all = decode(d);
  const ok = (m: number) => seasons.includes(d.matches[m].season);
  const bat = all.bat.filter((r) => ok(r.m));
  const bowl = all.bowl.filter((r) => ok(r.m));
  const innings = d.innings.filter((i) => ok(i[0]));
  const matchIds = [...new Set(innings.map((i) => i[0]))];
  const byInnBat = new Map<number, Bat[]>();
  const byInnBowl = new Map<number, Bowl[]>();
  for (const r of bat) (byInnBat.get(key(r.m, r.inn)) ?? byInnBat.set(key(r.m, r.inn), []).get(key(r.m, r.inn))!).push(r);
  for (const r of bowl) (byInnBowl.get(key(r.m, r.inn)) ?? byInnBowl.set(key(r.m, r.inn), []).get(key(r.m, r.inn))!).push(r);

  const raw = new Map<number, { bat: Bat[]; bowl: Bowl[]; field: Bat[]; victims: Bat[]; teams: Map<string, number>; matchIds: Set<number>; matchTeam: Map<number, string> }>();
  const get = (p: number) =>
    raw.get(p) ?? raw.set(p, { bat: [], bowl: [], field: [], victims: [], teams: new Map(), matchIds: new Set(), matchTeam: new Map() }).get(p)!;
  const seen = (p: number, team: string, m: number) => {
    const x = get(p);
    x.matchTeam.set(m, team);
    if (x.matchIds.has(m)) return;
    x.matchIds.add(m);
    x.teams.set(team, (x.teams.get(team) ?? 0) + d.matches[m].season * 1000 + m);
  };
  for (const r of bat) {
    get(r.p).bat.push(r);
    if (r.bw >= 0) get(r.bw).victims.push(r);
    for (const f of r.fl) if (f >= 0) get(f).field.push(r);
  }
  for (const r of bowl) get(r.p).bowl.push(r);
  // Presence: a name anywhere on the scorecard (batting, bowling, or a dismissal).
  for (const [m, p, team] of d.present) if (ok(m)) seen(p, team, m);

  const players = new Map<number, PlayerAgg>();
  for (const [p, x] of raw) {
    const B = aggBat(x.bat), W = aggBowl(x.bowl);
    let c = 0, kc = 0, st = 0, ro = 0;
    for (const r of x.field) {
      if (r.kind === "c" || r.kind === "cb") { c++; if (r.keeper) kc++; }
      else if (r.kind === "st") st++;
      else if (r.kind === "ro") ro++;
    }
    const teams = [...x.teams.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const bs = B.runs, ws = W.wk * 22;
    const phase: Record<Phase, number> = { powerplay: 0, middle: 0, death: 0 };
    for (const r of x.victims) { const ph = wicketPhase(r, d.matches[r.m].overs); if (ph) phase[ph]++; }
    const decided = [...x.matchIds].filter((m) => d.matches[m].winner);
    const wins = decided.filter((m) => d.matches[m].winner === teams[0]).length;
    players.set(p, {
      phase, winPct: decided.length ? (100 * wins) / decided.length : 0,
      p, bat: x.bat, bowl: x.bowl, field: x.field, victims: x.victims, B, W,
      F: { c, kc, st, ro, total: c + st + ro },
      teams, team: teams[0], matches: x.matchIds.size, matchIds: x.matchIds, matchTeam: x.matchTeam,
      role: bs + ws === 0 ? "Fielder" : Math.min(bs, ws) / Math.max(bs, ws) >= 0.4 ? "All-rounder" : bs > ws ? "Batter" : "Bowler",
    });
  }

  const LB = aggBat(bat), LW = aggBowl(bowl);
  const outs = bat.filter((r) => isOut(r.kind));
  const lk: Partial<Record<CardKind, number>> = {};
  for (const r of outs) lk[r.kind] = (lk[r.kind] ?? 0) + 1;
  const ld: Partial<Record<DuckType, number>> = {};
  for (const r of bat) { const t = duckType(r); if (t) ld[t] = (ld[t] ?? 0) + 1; }
  const credited = bat.filter((r) => r.bw >= 0);
  const lvk: Partial<Record<CardKind, number>> = {};
  for (const r of credited) lvk[r.kind] = (lvk[r.kind] ?? 0) + 1;

  const ps = [...players.values()];
  const rank = (pool: PlayerAgg[], cmp: (a: PlayerAgg, b: PlayerAgg) => number) => {
    const m = new Map<number, Rank>();
    [...pool].sort(cmp).forEach((x, i) => m.set(x.p, { rank: i + 1, of: pool.length }));
    return m;
  };
  const ranks = {
    runs: rank(ps.filter((x) => x.B.inns), (a, b) => b.B.runs - a.B.runs || (b.B.sr ?? 0) - (a.B.sr ?? 0) || (b.B.avg ?? 0) - (a.B.avg ?? 0)),
    sr: rank(ps.filter((x) => x.B.balls >= MIN_BALLS), (a, b) => b.B.sr! - a.B.sr!),
    six: rank(ps.filter((x) => x.B.inns), (a, b) => b.B.s6 - a.B.s6 || (b.B.sr ?? 0) - (a.B.sr ?? 0)),
    wk: rank(ps.filter((x) => x.W.spells), (a, b) => b.W.wk - a.W.wk || (a.W.econ ?? 99) - (b.W.econ ?? 99) || a.W.runs - b.W.runs),
    econ: rank(ps.filter((x) => x.W.balls >= MIN_BALLS), (a, b) => a.W.econ! - b.W.econ!),
    dot: rank(ps.filter((x) => x.W.balls >= MIN_BALLS), (a, b) => b.W.dotPct! - a.W.dotPct!),
    field: rank(ps.filter((x) => x.F.total), (a, b) => b.F.total - a.F.total),
    bnd: rank(ps.filter((x) => x.B.inns), (a, b) => b.B.f4 + b.B.s6 - (a.B.f4 + a.B.s6) || (b.B.sr ?? 0) - (a.B.sr ?? 0)),
    dots: rank(ps.filter((x) => x.W.spells), (a, b) => b.W.dots - a.W.dots || (b.W.dotPct ?? 0) - (a.W.dotPct ?? 0)),
    death: rank(ps.filter((x) => x.phase.death), (a, b) => b.phase.death - a.phase.death || (a.W.econ ?? 99) - (b.W.econ ?? 99)),
    pp: rank(ps.filter((x) => x.phase.powerplay), (a, b) => b.phase.powerplay - a.phase.powerplay || (a.W.econ ?? 99) - (b.W.econ ?? 99)),
  };
  // Team win % across the scope, for the "lucky charm" badge.
  const teamWin = new Map<string, number>();
  for (const t of new Set(innings.map((i) => i[2]))) {
    const ms = matchIds.filter((m) => d.matches[m].winner && (d.matches[m].teamA === t || d.matches[m].teamB === t));
    teamWin.set(t, ms.length ? (100 * ms.filter((m) => d.matches[m].winner === t).length) / ms.length : 0);
  }

  return {
    d, seasons, bat, bowl, innings, matchIds, byInnBat, byInnBowl, players,
    LB, LW, lk, outs: outs.length, ld, lvk, credited: credited.length, ranks, teamWin,
    matchdays: [...new Set(matchIds.map((m) => d.matches[m].date))].sort(),
  };
}

// ─── Percentiles & DNA ───────────────────────────────────────────────────────

/** Share of the qualified pool this value beats (0–100). */
function percentile(pool: number[], v: number, higherBetter: boolean) {
  if (pool.length < 2) return 50;
  const beaten = pool.filter((x) => (higherBetter ? x < v : x > v)).length;
  const tied = pool.filter((x) => x === v).length - 1;
  return Math.round((100 * (beaten + tied / 2)) / (pool.length - 1));
}

export type DnaAxis = { label: string; value: string; pct: number; hint: string };
export type Dna = { tags: string[]; batting: DnaAxis[]; bowling: DnaAxis[] };

export function playerDna(S: ScopeIndex, x: PlayerAgg): Dna {
  const ps = [...S.players.values()];
  const qb = ps.filter((y) => y.B.balls >= MIN_BALLS);
  const qw = ps.filter((y) => y.W.balls >= MIN_BALLS);
  const tags: string[] = [];
  const batting: DnaAxis[] = [];
  const bowling: DnaAxis[] = [];
  const axis = (pool: PlayerAgg[], f: (y: PlayerAgg) => number | null, hb: boolean) => {
    const vals = pool.map(f).filter((v): v is number => v != null);
    const v = f(x);
    return v == null ? null : percentile(vals, v, hb);
  };
  if (x.B.balls >= MIN_BALLS) {
    const add = (label: string, hint: string, f: (y: PlayerAgg) => number | null, hb: boolean, fmt: (v: number) => string) => {
      const p = axis(qb, f, hb);
      const v = f(x);
      if (p != null && v != null) batting.push({ label, hint, pct: p, value: fmt(v) });
      return p ?? 0;
    };
    const power = add("Power", "Sixes per 100 balls", (y) => y.B.six100, true, (v) => f1(v));
    const tempo = add("Tempo", "Strike rate", (y) => y.B.sr, true, (v) => f0(v));
    const value = add("Consistency", "Batting average", (y) => y.B.avg, true, (v) => f1(v));
    const rotate = add("Strike rotation", "Strike rate off non-boundary balls", (y) => y.B.nbSR, true, (v) => f0(v));
    const survive = add("Survival", "Balls per dismissal", (y) => y.B.bpd ?? (y.B.balls ? y.B.balls * 2 : null), true, (v) => f1(v));
    const bndDep = axis(qb, (y) => y.B.bndPct, true) ?? 0;
    const notOutRate = x.B.inns ? x.B.no / x.B.inns : 0;
    if (power >= 75) tags.push("Power hitter");
    if (value >= 75 && tempo <= 55) tags.push("Anchor");
    if (tempo >= 70 && notOutRate >= 0.35) tags.push("Finisher");
    if (rotate >= 75) tags.push("Strike rotator");
    if (bndDep >= 75 && rotate <= 30) tags.push("Boundary-or-bust");
    if (survive <= 20 && tempo <= 35) tags.push("Searching for form");
  }
  if (x.W.balls >= MIN_BALLS) {
    const add = (label: string, hint: string, f: (y: PlayerAgg) => number | null, hb: boolean, fmt: (v: number) => string) => {
      const p = axis(qw, f, hb);
      const v = f(x);
      if (p != null && v != null) bowling.push({ label, hint, pct: p, value: fmt(v) });
      return p ?? 0;
    };
    const control = add("Control", "Economy, lower is better", (y) => y.W.econ, false, (v) => f2(v));
    const threat = add("Wicket threat", "Balls per wicket, lower is better", (y) => y.W.sr ?? y.W.balls * 3, false, (v) => f1(v));
    const pressure = add("Pressure", "Dot-ball percentage", (y) => y.W.dotPct, true, (v) => `${f0(v)}%`);
    const discipline = add("Discipline", "Wides per over, lower is better", (y) => y.W.wdo, false, (v) => f2(v));
    if (threat >= 75) tags.push("Strike bowler");
    if (control >= 75) tags.push("Run-stopper");
    if (pressure >= 75) tags.push("Dot-ball specialist");
    if (discipline <= 20) tags.push("Wide-prone");
    if (control >= 60 && threat <= 35) tags.push("Holding bowler");
  }
  if (x.F.total >= 6) {
    const pool = ps.filter((y) => y.matches >= 3).map((y) => y.F.total / y.matches);
    if (percentile(pool, x.F.total / Math.max(1, x.matches), true) >= 85) tags.push("Safe hands");
  }
  return { tags, batting, bowling };
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export type BadgeTone = "crown" | "bat" | "ball" | "field" | "team" | "warn";
export type Badge = { label: string; tone: BadgeTone; why: string };

/** Every badge that can be earned, with its icon (a lucide-react name) and the rule that unlocks it. */
export const BADGE_CATALOG: { label: string; tone: BadgeTone; icon: string; rule: string }[] = [
  { label: "Orange Cap", tone: "crown", icon: "Crown", rule: "Most runs in the league." },
  { label: "Purple Cap", tone: "crown", icon: "Crown", rule: "Most wickets in the league." },
  { label: "Six Machine", tone: "crown", icon: "Rocket", rule: "Most sixes in the league." },
  { label: "Boundary King", tone: "crown", icon: "Trophy", rule: "Most fours and sixes combined." },
  { label: "Fastest Scorer", tone: "crown", icon: "Zap", rule: "Best strike rate, min 30 balls." },
  { label: "Most Economical", tone: "crown", icon: "Shield", rule: "Best economy, min 30 balls bowled." },
  { label: "Dot-Ball Monster", tone: "crown", icon: "Snowflake", rule: "Most dot balls bowled in the league." },
  { label: "Death-Over King", tone: "crown", icon: "Moon", rule: "Most wickets in the last 2 overs (min 2)." },
  { label: "Powerplay Striker", tone: "crown", icon: "Sunrise", rule: "Most wickets in the first 2 overs (min 2)." },
  { label: "Gold Glove", tone: "crown", icon: "Hand", rule: "Most fielding dismissals in the league." },
  { label: "Man of the Moment", tone: "crown", icon: "Trophy", rule: "Most Player of the Match awards (min 2)." },
  { label: "Power Hitter", tone: "bat", icon: "Bomb", rule: "Top 25% for sixes per 100 balls." },
  { label: "Strike-Rate Beast", tone: "bat", icon: "Flame", rule: "Top 20% for strike rate." },
  { label: "Mr Consistent", tone: "bat", icon: "BadgeCheck", rule: "Top 20% for batting average, 3+ dismissals." },
  { label: "Anchor", tone: "bat", icon: "Anchor", rule: "Top 30% average while scoring at or below the median rate." },
  { label: "Finisher", tone: "bat", icon: "Flag", rule: "Not out in 35%+ of innings while scoring fast." },
  { label: "Strike Rotator", tone: "bat", icon: "Repeat", rule: "Top 25% for runs off non-boundary balls." },
  { label: "Boundary or Bust", tone: "bat", icon: "Target", rule: "Top 20% for share of runs in boundaries, rarely rotates." },
  { label: "Hard to Bowl", tone: "bat", icon: "BrickWall", rule: "Bowled or LBW in 6% or fewer of 8+ dismissals." },
  { label: "Chase Master", tone: "bat", icon: "TrendingUp", rule: "Scores 20%+ faster chasing, above the league rate." },
  { label: "Total Builder", tone: "bat", icon: "Mountain", rule: "Scores 20%+ faster batting first, above the league rate." },
  { label: "Top-Order Rock", tone: "bat", icon: "Gem", rule: "Opens or bats at 2 with a top-40% average." },
  { label: "Big Scorer", tone: "bat", icon: "Star", rule: "Three or more scores of 30+." },
  { label: "Strike Bowler", tone: "ball", icon: "Crosshair", rule: "Top 25% for balls per wicket, 3+ wickets." },
  { label: "Run-Stopper", tone: "ball", icon: "ShieldCheck", rule: "Top 25% for economy." },
  { label: "Dependable Bowler", tone: "ball", icon: "Handshake", rule: "Bowls in 70%+ of matches, under the league economy, 8+ overs." },
  { label: "Pressure Builder", tone: "ball", icon: "Gauge", rule: "Top 20% for dot-ball percentage." },
  { label: "Line & Length", tone: "ball", icon: "Ruler", rule: "Top 20% for fewest wides, 8+ overs." },
  { label: "Holding Bowler", tone: "ball", icon: "Scale", rule: "Economical but rarely takes wickets." },
  { label: "Stump Hunter", tone: "ball", icon: "Swords", rule: "35%+ of 4+ wickets bowled or LBW." },
  { label: "Death-Over Specialist", tone: "ball", icon: "Hourglass", rule: "4+ wickets in the last 2 overs." },
  { label: "New-Ball Threat", tone: "ball", icon: "Sunrise", rule: "4+ wickets in the first 2 overs." },
  { label: "Duck Maker", tone: "ball", icon: "Egg", rule: "Dismissed 4+ batters for a duck." },
  { label: "Multi-Wicket Man", tone: "ball", icon: "Sparkles", rule: "Three or more spells of 2+ wickets." },
  { label: "Maiden Maker", tone: "ball", icon: "CircleSlash", rule: "Two or more maidens in box cricket." },
  { label: "Gloveman", tone: "field", icon: "Hand", rule: "4+ catches or stumpings as wicketkeeper." },
  { label: "Run-Out Specialist", tone: "field", icon: "Footprints", rule: "Involved in 4+ run outs." },
  { label: "Safe Hands", tone: "field", icon: "Award", rule: "Top 15% for catches per match, 5+ catches." },
  { label: "Genuine All-Rounder", tone: "team", icon: "Medal", rule: "60+ runs and 4+ wickets, both skills pulling weight." },
  { label: "Ever-Present", tone: "team", icon: "CalendarCheck", rule: "Played 90%+ of his team's matches (8+)." },
  { label: "Lucky Charm", tone: "team", icon: "Clover", rule: "His team wins 12+ points more often when he plays." },
  { label: "Two-Season Regular", tone: "team", icon: "Infinity", rule: "Played in both Season 2 and Season 3." },
  { label: "Match Winner", tone: "team", icon: "Award", rule: "Three or more Player of the Match awards." },
  { label: "Duck Magnet", tone: "warn", icon: "Egg", rule: "Ducks in 20%+ of innings (3+ ducks)." },
  { label: "Dot-Ball Heavy", tone: "warn", icon: "Turtle", rule: "Top 15% for dot balls faced." },
  { label: "Wide-Prone", tone: "warn", icon: "Wind", rule: "Bottom 20% for wides per over, 5+ wides." },
  { label: "Expensive", tone: "warn", icon: "Banknote", rule: "Concedes 20%+ above the league economy." },
];

/** Every label the numbers support, crowns first. Rate badges need MIN_BALLS. */
export function playerBadges(S: ScopeIndex, x: PlayerAgg): Badge[] {
  const out: Badge[] = [];
  const add = (label: string, tone: BadgeTone, why: string) => out.push({ label, tone, why });
  const r = (k: keyof ScopeIndex["ranks"]) => S.ranks[k].get(x.p);
  const top = (k: keyof ScopeIndex["ranks"]) => r(k)?.rank === 1;
  const b = x.B, w = x.W, LB = S.LB, LW = S.LW;
  const ps = [...S.players.values()];
  const qb = ps.filter((y) => y.B.balls >= MIN_BALLS), qw = ps.filter((y) => y.W.balls >= MIN_BALLS);
  const pctl = (pool: PlayerAgg[], f: (y: PlayerAgg) => number | null, hb: boolean) => {
    const v = f(x);
    return v == null ? 0 : percentile(pool.map(f).filter((n): n is number => n != null), v, hb);
  };

  // Crowns
  if (top("runs") && b.runs) add("Orange Cap", "crown", `Most runs: ${b.runs}.`);
  if (top("wk") && w.wk) add("Purple Cap", "crown", `Most wickets: ${w.wk}.`);
  if (top("six") && b.s6) add("Six Machine", "crown", `Most sixes: ${b.s6}.`);
  if (top("bnd") && b.f4 + b.s6) add("Boundary King", "crown", `Most boundaries: ${b.f4 + b.s6}.`);
  if (top("sr")) add("Fastest Scorer", "crown", `Best strike rate (30+ balls): ${f1(b.sr)}.`);
  if (top("econ")) add("Most Economical", "crown", `Best economy (5+ overs): ${f2(w.econ)}.`);
  if (top("dots") && w.dots) add("Dot-Ball Monster", "crown", `Most dot balls bowled: ${w.dots}.`);
  if (top("death") && x.phase.death >= 2) add("Death-Over King", "crown", `Most wickets in the last 2 overs: ${x.phase.death}.`);
  if (top("pp") && x.phase.powerplay >= 2) add("Powerplay Striker", "crown", `Most wickets in the first 2 overs: ${x.phase.powerplay}.`);
  if (top("field") && x.F.total) add("Gold Glove", "crown", `Most fielding dismissals: ${x.F.total}.`);
  const moms = momCounts(S.d, S.seasons);
  const myMoM = moms.get(x.p)?.length ?? 0;
  const mostMoM = Math.max(0, ...[...moms.values()].map((v) => v.length));
  const momLeaders = [...moms.values()].filter((v) => v.length === mostMoM).length;
  if (myMoM >= 2 && myMoM === mostMoM) add("Man of the Moment", "crown", `${momLeaders > 1 ? "Joint-most" : "Most"} Player of the Match awards: ${myMoM}.`);

  // Batting style
  if (b.balls >= MIN_BALLS) {
    const power = pctl(qb, (y) => y.B.six100, true), tempo = pctl(qb, (y) => y.B.sr, true);
    const value = pctl(qb, (y) => y.B.avg, true), rotate = pctl(qb, (y) => y.B.nbSR, true);
    const dep = pctl(qb, (y) => y.B.bndPct, true), dotsHeavy = pctl(qb, (y) => y.B.dotPct, true);
    if (power >= 75) add("Power Hitter", "bat", `A six every ${f1(b.balls / Math.max(1, b.s6))} balls.`);
    if (tempo >= 80) add("Strike-Rate Beast", "bat", `Strike rate ${f0(b.sr)}, top 20% of the league.`);
    if (value >= 80 && b.outs >= 3) add("Mr Consistent", "bat", `Averages ${f1(b.avg)}, top 20% of the league.`);
    if (value >= 70 && tempo <= 50) add("Anchor", "bat", `Holds an end: average ${f1(b.avg)} at a strike rate of ${f0(b.sr)}.`);
    if (tempo >= 65 && b.inns >= 5 && b.no / b.inns >= 0.35) add("Finisher", "bat", `Not out in ${b.no} of ${b.inns} innings at a strike rate of ${f0(b.sr)}.`);
    if (rotate >= 75) add("Strike Rotator", "bat", `Scores ${f0(b.nbSR)} per 100 off non-boundary balls.`);
    if (dep >= 80 && rotate <= 30) add("Boundary or Bust", "bat", `${f0(b.bndPct)}% of runs in boundaries.`);
    if (dotsHeavy >= 85) add("Dot-Ball Heavy", "warn", `Faces at least ${f0(b.dotPct)}% dot balls.`);
    if (b.outs >= 8 && ((b.kinds.b ?? 0) + (b.kinds.lbw ?? 0)) / b.outs <= 0.06) add("Hard to Bowl", "bat", `Bowled or LBW only ${plural((b.kinds.b ?? 0) + (b.kinds.lbw ?? 0), "time")} in ${b.outs} dismissals.`);
    const chase = aggBat(x.bat.filter((q) => q.inn === 2)), first = aggBat(x.bat.filter((q) => q.inn === 1));
    if (chase.inns >= 4 && chase.sr && first.sr && chase.sr >= first.sr * 1.2 && chase.sr >= (LB.sr ?? 0)) add("Chase Master", "bat", `Strike rate ${f0(chase.sr)} chasing.`);
    if (first.inns >= 4 && first.sr && chase.sr && first.sr >= chase.sr * 1.2 && first.sr >= (LB.sr ?? 0)) add("Total Builder", "bat", `Strike rate ${f0(first.sr)} batting first.`);
    const avgPos = x.bat.reduce((s, q) => s + q.pos, 0) / x.bat.length;
    if (avgPos <= 2.2 && value >= 60) add("Top-Order Rock", "bat", `Opens or bats at 2 and averages ${f1(b.avg)}.`);
    if (b.t30 >= 3) add("Big Scorer", "bat", `${b.t30} scores of 30 or more.`);
  }
  if (b.inns >= 5 && b.ducks >= 3 && b.ducks / b.inns >= 0.2) add("Duck Magnet", "warn", `${b.ducks} ducks in ${b.inns} innings.`);

  // Bowling style
  if (w.balls >= MIN_BALLS) {
    const control = pctl(qw, (y) => y.W.econ, false), threat = pctl(qw, (y) => y.W.sr ?? y.W.balls * 3, false);
    const pressure = pctl(qw, (y) => y.W.dotPct, true), discipline = pctl(qw, (y) => y.W.wdo, false);
    const regular = x.matches ? new Set(x.bowl.map((q) => q.m)).size / x.matches : 0;
    if (threat >= 75 && w.wk >= 3) add("Strike Bowler", "ball", `A wicket every ${f1(w.sr)} balls.`);
    if (control >= 75) add("Run-Stopper", "ball", `Economy ${f2(w.econ)}, top 25% of the league.`);
    if (w.econ! <= LW.econ! && regular >= 0.7 && w.balls >= 48) add("Dependable Bowler", "ball", `Bowls in ${Math.round(100 * regular)}% of his matches and concedes under the league rate.`);
    if (pressure >= 80 && !top("dots")) add("Pressure Builder", "ball", `${f0(w.dotPct)}% dot balls, top 20% of the league.`);
    if (discipline >= 80 && w.balls >= 48) add("Line & Length", "ball", `Only ${f2(w.wdo)} wides an over.`);
    if (discipline <= 20 && w.wd >= 5) add("Wide-Prone", "warn", `${f2(w.wdo)} wides an over.`);
    if (control >= 60 && threat <= 35) add("Holding Bowler", "ball", "Keeps it tight but rarely takes wickets.");
    if (w.econ! >= LW.econ! * 1.2) add("Expensive", "warn", `Concedes ${f2(w.econ)} an over.`);
  }
  const stumps = x.victims.filter((q) => q.kind === "b" || q.kind === "lbw").length;
  if (w.wk >= 4 && stumps / w.wk >= 0.35) add("Stump Hunter", "ball", `${stumps} of ${w.wk} wickets bowled or LBW.`);
  if (x.phase.death >= 4 && !top("death")) add("Death-Over Specialist", "ball", `${x.phase.death} wickets in the last 2 overs.`);
  if (x.phase.powerplay >= 4 && !top("pp")) add("New-Ball Threat", "ball", `${x.phase.powerplay} wickets in the first 2 overs.`);
  const ducksTaken = x.victims.filter((q) => duckType(q)).length;
  if (ducksTaken >= 4) add("Duck Maker", "ball", `${ducksTaken} batters out for a duck.`);
  if (w.hauls2 >= 3) add("Multi-Wicket Man", "ball", `${w.hauls2} spells of 2+ wickets.`);
  if (w.mdn >= 2) add("Maiden Maker", "ball", `${plural(w.mdn, "maiden")} in box cricket.`);

  // Fielding
  if (x.F.kc + x.F.st >= 4) add("Gloveman", "field", `${x.F.kc} catches and ${x.F.st} stumpings behind the stumps.`);
  if (x.F.ro >= 4) add("Run-Out Specialist", "field", `Involved in ${x.F.ro} run outs.`);
  if (x.F.c >= 5 && x.matches >= 4 && pctl(ps.filter((y) => y.matches >= 3), (y) => y.F.c / Math.max(1, y.matches), true) >= 85) add("Safe Hands", "field", `${x.F.c} catches in ${x.matches} matches.`);

  // Team & attendance
  if (x.role === "All-rounder" && b.runs >= 60 && w.wk >= 4) add("Genuine All-Rounder", "team", `${b.runs} runs and ${w.wk} wickets.`);
  const att = attendanceFor(S, x);
  if (att.teamMatches >= 8 && att.pct >= 90) add("Ever-Present", "team", `Played ${att.present} of his team's ${att.teamMatches} matches.`);
  const tw = S.teamWin.get(x.team) ?? 0;
  if (x.matches >= 6 && x.winPct >= tw + 12) add("Lucky Charm", "team", `${x.team} win ${f0(x.winPct)}% when he plays (${f0(tw)}% overall).`);
  if (S.seasons.length > 1 && new Set([...x.matchIds].map((m) => S.d.matches[m].season)).size > 1) add("Two-Season Regular", "team", "Played in Seasons 2 and 3.");
  if (myMoM >= 3) add("Match Winner", "team", `${myMoM} Player of the Match awards.`);
  return out;
}

// ─── Insights & next steps ───────────────────────────────────────────────────

export type Note = { title: string; body: string };
export type Tip = { title: string; why: string; next: string; target?: string };

function insights(S: ScopeIndex, x: PlayerAgg) {
  const good: Note[] = [], bad: Note[] = [], info: Note[] = [];
  const b = x.B, w = x.W, LB = S.LB, LW = S.LW;
  if (b.balls >= MIN_BALLS && b.inns >= 4) {
    if (b.sr! >= LB.sr! * 1.25) good.push({ title: "Scores fast", body: `Strike rate ${f0(b.sr)} against a league ${f0(LB.sr)}.` });
    else if (b.sr! < LB.sr! * 0.85) bad.push({ title: "Scores slowly", body: `Strike rate ${f0(b.sr)} against a league ${f0(LB.sr)}.` });
    if (b.avg != null && b.avg >= LB.avg! * 1.4) good.push({ title: "Hard to dismiss", body: `Averages ${f1(b.avg)} against a league ${f1(LB.avg)}.` });
    else if (b.avg != null && b.avg < LB.avg! * 0.7) bad.push({ title: "Gets out cheaply", body: `Averages ${f1(b.avg)} against a league ${f1(LB.avg)}.` });
    if (b.bpb && b.bpb <= LB.bpb! * 0.75) good.push({ title: "Big hitter", body: `A boundary every ${f1(b.bpb)} balls (league ${f1(LB.bpb)}), ${plural(b.s6, "six", "sixes")}.` });
    if (b.bndPct! > 80 && b.nbSR != null && b.nbSR < 40) bad.push({ title: "Rarely rotates strike", body: `${f0(b.bndPct)}% of runs come in boundaries. Off other balls he scores ${f0(b.nbSR)} per 100.` });
    else if (b.nbSR != null && b.nbSR >= 55) good.push({ title: "Keeps the board moving", body: `Scores ${f0(b.nbSR)} per 100 off balls that don't reach the rope.` });
    if (b.outs >= 5) {
      const air = ((b.kinds.c ?? 0) + (b.kinds.cb ?? 0)) / b.outs, lair = ((S.lk.c ?? 0) + (S.lk.cb ?? 0)) / S.outs;
      if (air >= lair + 0.12) bad.push({ title: "Gets out in the air", body: `${Math.round(100 * air)}% of dismissals are catches (league ${Math.round(100 * lair)}%).` });
      const st = ((b.kinds.b ?? 0) + (b.kinds.lbw ?? 0)) / b.outs, lst = ((S.lk.b ?? 0) + (S.lk.lbw ?? 0)) / S.outs;
      if (st >= lst + 0.12) bad.push({ title: "Beaten by straight balls", body: `Bowled or LBW in ${Math.round(100 * st)}% of dismissals (league ${Math.round(100 * lst)}%).` });
      else if (b.outs >= 8 && st <= 0.06) good.push({ title: "Tight defence", body: `Bowled or LBW only ${plural((b.kinds.b ?? 0) + (b.kinds.lbw ?? 0), "time")} in ${b.outs} dismissals.` });
      if ((b.kinds.ro ?? 0) >= 2 && (b.kinds.ro ?? 0) / b.outs >= 0.25) bad.push({ title: "Run-out risk", body: `${b.kinds.ro} of ${b.outs} dismissals were run outs.` });
      const keep = x.bat.filter((r) => isOut(r.kind) && r.keeper).length;
      if (keep >= 3 && keep / b.outs >= 0.3) bad.push({ title: "Keeper's wicket", body: `The keeper took ${keep} of his ${b.outs} dismissals.` });
    }
    const early = aggBat(x.bat.filter((r) => r.balls < 10)), set = aggBat(x.bat.filter((r) => r.balls >= 10));
    if (early.outs >= 3 && set.inns >= 3 && (early.avg ?? 0) < 9 && (set.avg == null || set.avg >= 2 * (early.avg || 1)))
      bad.push({ title: "Vulnerable early", body: `Averages ${f1(early.avg)} in innings under 10 balls; ${set.avg == null ? "never out" : `averages ${f1(set.avg)}`} once past 10.` });
    const first = aggBat(x.bat.filter((r) => r.inn === 1)), chase = aggBat(x.bat.filter((r) => r.inn === 2));
    if (first.inns >= 3 && chase.inns >= 3 && first.sr && chase.sr) {
      if (chase.sr >= first.sr * 1.2) info.push({ title: "Better chasing", body: `Strike rate ${f0(chase.sr)} chasing, ${f0(first.sr)} batting first.` });
      else if (first.sr >= chase.sr * 1.2) info.push({ title: "Better setting a total", body: `Strike rate ${f0(first.sr)} batting first, ${f0(chase.sr)} chasing.` });
    }
    if (S.seasons.length > 1) {
      const s2 = aggBat(x.bat.filter((r) => S.d.matches[r.m].season === 2)), s3 = aggBat(x.bat.filter((r) => S.d.matches[r.m].season === 3));
      if (s2.balls >= 25 && s3.balls >= 25) {
        if (s3.sr! >= s2.sr! * 1.15) good.push({ title: "Improving", body: `Strike rate up from ${f0(s2.sr)} in Season 2 to ${f0(s3.sr)} in Season 3.` });
        else if (s3.sr! <= s2.sr! * 0.85) bad.push({ title: "Form has dipped", body: `Strike rate down from ${f0(s2.sr)} in Season 2 to ${f0(s3.sr)} in Season 3.` });
      }
    }
    if (b.ducks >= 3 && b.ducks / b.inns >= 0.15) bad.push({ title: "Duck-prone", body: `${plural(b.ducks, "duck")} in ${b.inns} innings.` });
  }
  if (w.balls >= MIN_BALLS) {
    if (w.econ! <= LW.econ! * 0.85) good.push({ title: "Economical", body: `Concedes ${f2(w.econ)} an over against a league ${f2(LW.econ)}.` });
    else if (w.econ! >= LW.econ! * 1.15) bad.push({ title: "Expensive", body: `Concedes ${f2(w.econ)} an over against a league ${f2(LW.econ)}.` });
    if (w.wk >= 3 && w.sr! <= LW.sr! * 0.8) good.push({ title: "Takes wickets", body: `One every ${f1(w.sr)} balls (league ${f1(LW.sr)}).` });
    else if (!w.wk || w.sr! >= LW.sr! * 1.5) bad.push({ title: "Few wickets", body: w.wk ? `One every ${f1(w.sr)} balls (league ${f1(LW.sr)}).` : `No wickets in ${ov(w.balls)} overs.` });
    if (w.dotPct! >= LW.dotPct! + 5) good.push({ title: "Builds pressure", body: `${f0(w.dotPct)}% dot balls (league ${f0(LW.dotPct)}%).` });
    if (w.wd >= 5 && w.wdo! >= LW.wdo! * 1.3) bad.push({ title: "Too many wides", body: `${f2(w.wdo)} an over (league ${f2(LW.wdo)}), ${w.wd} in total.` });
    const stumps = x.victims.filter((r) => r.kind === "b" || r.kind === "lbw").length;
    if (w.wk >= 4 && stumps / w.wk >= 0.35) good.push({ title: "Attacks the stumps", body: `${stumps} of ${w.wk} wickets bowled or LBW.` });
  }
  if (x.F.total >= 8) good.push({ title: "Strong in the field", body: `${x.F.total} dismissals: ${plural(x.F.c, "catch", "catches")}, ${plural(x.F.ro, "run out")}${x.F.st ? `, ${plural(x.F.st, "stumping")}` : ""}.` });
  return { good: good.slice(0, 5), bad: bad.slice(0, 5), info };
}

/** Practical next steps, most pressing first. Each names the number it rests on and a target. */
function battingTips(S: ScopeIndex, x: PlayerAgg, chances: Chances): Tip[] {
  const b = x.B, LB = S.LB;
  if (!b.inns) return [];
  const tips: (Tip & { w: number })[] = [];
  if (b.balls < MIN_BALLS) {
    tips.push({
      w: 1, title: "Get more time in the middle",
      why: `Only ${plural(b.balls, "ball")} faced in ${plural(b.inns, "innings", "innings")}, too few to judge.`,
      next: "Ask the captain for a promotion in a dead rubber or a net session against your team's bowlers, so there's enough to build on.",
    });
    return tips;
  }
  const early = aggBat(x.bat.filter((r) => r.balls < 10)), set = aggBat(x.bat.filter((r) => r.balls >= 10));
  if (early.outs >= 3 && (early.avg ?? 0) < 9 && set.inns >= 2) {
    tips.push({
      w: 10 + early.outs, title: "Survive the first 10 balls",
      why: `${early.outs} of ${b.outs} dismissals came before 10 balls, averaging ${f1(early.avg)}. Past 10 balls you ${set.avg == null ? "haven't been dismissed" : `average ${f1(set.avg)}`} at a strike rate of ${f0(set.sr)}.`,
      next: "Treat the first over you face as sighting time: hit along the ground, take the single, and save the lofted shot until you've seen the bowler's pace and the bounce.",
      target: `Halve the early dismissals: no more than ${Math.max(1, Math.floor(early.outs / 2))} next season.`,
    });
  }
  if (b.nbSR != null && b.nbSR < 40 && (b.bndPct ?? 0) >= 75) {
    tips.push({
      w: 9, title: "Rotate the strike",
      why: `${f0(b.bndPct)}% of your runs come in boundaries, and off other balls you score ${f0(b.nbSR)} per 100 (league ${f0(LB.nbSR)}). When the boundaries dry up, so does the scoring.`,
      next: "Work the ball into the gaps square of the wicket and run hard for the first one. In box cricket a quick single puts the pressure back on the fielders.",
      target: `Lift the strike rate off non-boundary balls to ${Math.max(50, Math.round(LB.nbSR ?? 50))}.`,
    });
  }
  if (b.outs >= 5) {
    const air = ((b.kinds.c ?? 0) + (b.kinds.cb ?? 0)) / b.outs, lair = ((S.lk.c ?? 0) + (S.lk.cb ?? 0)) / S.outs;
    const keep = x.bat.filter((r) => isOut(r.kind) && r.keeper).length;
    if (keep >= 3 && keep / b.outs >= 0.3) {
      tips.push({
        w: 8, title: "Take the keeper out of the game",
        why: `The keeper caught or stumped you ${plural(keep, "time")} out of ${b.outs} dismissals.`,
        next: "Play the ball later and under your eyes, leave the wide ones early in the innings, and keep the bat face straighter on the drive.",
        target: "No more than one dismissal to the keeper in your next 10 innings.",
      });
    } else if (air >= lair + 0.12) {
      tips.push({
        w: 7, title: "Keep it on the ground early",
        why: `${Math.round(100 * air)}% of your dismissals are catches, against ${Math.round(100 * lair)}% across the league.`,
        next: "Pick your lofted shots: go aerial only straight down the ground or into the area with no fielder, and only once you're set.",
        target: `Bring caught dismissals down to the league rate of ${Math.round(100 * lair)}%.`,
      });
    }
    const st = ((b.kinds.b ?? 0) + (b.kinds.lbw ?? 0)) / b.outs, lst = ((S.lk.b ?? 0) + (S.lk.lbw ?? 0)) / S.outs;
    if (st >= lst + 0.12) {
      tips.push({
        w: 7, title: "Defend the straight ball",
        why: `Bowled or LBW in ${Math.round(100 * st)}% of dismissals (league ${Math.round(100 * lst)}%).`,
        next: "Get the front foot to the line of the ball and play straight balls back down the pitch. Hit across the line only when it's well outside off.",
      });
    }
    if ((b.kinds.ro ?? 0) >= 2 && (b.kinds.ro ?? 0) / b.outs >= 0.2) {
      tips.push({
        w: 6, title: "Call and run better",
        why: `${b.kinds.ro} of your ${b.outs} dismissals were run outs.`,
        next: "Call early and loudly, back up a step from the non-striker's end, and never run on a misfield to a fielder's strong arm.",
        target: "Zero run outs next season.",
      });
    }
  }
  if (b.sr! < LB.sr! * 0.9) {
    tips.push({
      w: 6, title: "Find more boundaries",
      why: `Strike rate ${f0(b.sr)} against a league ${f0(LB.sr)}; a boundary every ${f1(b.bpb)} balls (league ${f1(LB.bpb)}).`,
      next: "Pick two scoring zones you trust and look to hit the bad ball there every time. In a 7-over game a dot ball costs more than a wicket.",
      target: `A boundary every ${f1(Math.max(4, (LB.bpb ?? 6) * 0.95))} balls.`,
    });
  }
  const starts = x.bat.filter((r) => r.runs >= 10 && r.runs < 20 && isOut(r.kind)).length;
  if (starts >= 3 && starts >= b.t20) {
    tips.push({
      w: 5, title: "Convert the starts",
      why: `${plural(starts, "innings", "innings")} ended between 10 and 19, and ${b.t20} went past 20.`,
      next: "Once you reach 10, reset: take two or three low-risk balls before going big again. Bowlers change plans when you look set.",
      target: `Turn at least half of those starts into 20+ scores.`,
    });
  }
  if (b.ducks >= 2 && b.ducks / b.inns >= 0.15) {
    tips.push({
      w: 5, title: "Get off the mark",
      why: `${plural(b.ducks, "duck")} in ${b.inns} innings (${f0(pct(b.ducks, b.inns))}%).`,
      next: "Have a first-ball plan: a soft-handed push for one into the off side. The first run settles the nerves.",
    });
  }
  const first = aggBat(x.bat.filter((r) => r.inn === 1)), chase = aggBat(x.bat.filter((r) => r.inn === 2));
  if (first.inns >= 3 && chase.inns >= 3 && first.sr && chase.sr && chase.sr >= first.sr * 1.25) {
    tips.push({
      w: 4, title: "Bat first with intent",
      why: `Strike rate ${f0(first.sr)} batting first against ${f0(chase.sr)} chasing.`,
      next: "Set yourself a run-rate target before you walk out. Batting first, a par score needs about 9 an over.",
    });
  } else if (first.inns >= 3 && chase.inns >= 3 && first.sr && chase.sr && first.sr >= chase.sr * 1.25) {
    tips.push({
      w: 4, title: "Pace the chase",
      why: `Strike rate ${f0(chase.sr)} chasing against ${f0(first.sr)} batting first.`,
      next: "Break the target into overs and keep the required rate in your head. Chases are won by singles as much as sixes.",
    });
  }
  if (chances.underusedBat) {
    tips.push({
      w: 3, title: "Make the case for a higher slot",
      why: `You strike at ${f0(b.sr)} (league ${f0(LB.sr)}) but face ${f1(chances.ballsPerMatch)} balls a match, below your team's ${f1(chances.teamBallsPerMatch)}.`,
      next: "Show the numbers to your captain. Batting higher in a 7-over game is the quickest way to more runs.",
    });
  }
  if (!tips.length) {
    tips.push({
      w: 0, title: "Keep doing what works",
      why: `Average ${f1(b.avg)} and strike rate ${f0(b.sr)}, both at or above league level.`,
      next: "Bank the method, and add one new scoring shot in the nets so bowlers can't settle on a single plan.",
    });
  }
  return tips.sort((a, b) => b.w - a.w).slice(0, 4).map((t): Tip => ({ title: t.title, why: t.why, next: t.next, target: t.target }));
}

function bowlingTips(S: ScopeIndex, x: PlayerAgg, chances: Chances, opp: BowlSplit[], faced: BowlerMatchup[]): Tip[] {
  const w = x.W, LW = S.LW;
  if (!w.spells) return [];
  const tips: (Tip & { w: number })[] = [];
  if (w.balls < MIN_BALLS) {
    tips.push({
      w: 1, title: "Bowl more overs",
      why: `Only ${ov(w.balls)} overs bowled, too few to read a pattern.`,
      next: "Ask for an over in the middle of the innings and bowl to one plan, so there's a baseline to improve on.",
    });
    return tips;
  }
  if (w.wd >= 4 && w.wdo! >= LW.wdo! * 1.2) {
    tips.push({
      w: 10, title: "Cut the wides",
      why: `${plural(w.wd, "wide")}, ${f2(w.wdo)} an over against a league ${f2(LW.wdo)}. Each one is a free run and an extra ball in a 7-over game.`,
      next: "Bowl at a single stump in practice and shorten your run-up until the line is grooved. Aim at the stumps, not the edges.",
      target: `Under ${f2(LW.wdo)} wides an over.`,
    });
  }
  if (w.nb >= 3) {
    tips.push({
      w: 8, title: "Fix the front foot",
      why: `${plural(w.nb, "no-ball")}: each one is a run, an extra ball and a free hit.`,
      next: "Measure your run-up and mark it. Practise landing behind the line at full pace.",
      target: "Zero no-balls next season.",
    });
  }
  if (w.econ! >= LW.econ! * 1.1) {
    tips.push({
      w: 9, title: "Bring the economy down",
      why: `${f2(w.econ)} an over against a league ${f2(LW.econ)}, with ${f0(w.dotPct)}% dot balls (league ${f0(LW.dotPct)}%).`,
      next: "Bowl to your field: agree a line with the captain before the over, and stick to a good length rather than trying a different ball every time.",
      target: `Economy under ${f2(LW.econ)} and ${Math.round((LW.dotPct ?? 55) + 3)}% dot balls.`,
    });
  }
  if (!w.wk || w.sr! >= LW.sr! * 1.4) {
    const lst = Math.round(100 * (((S.lvk.b ?? 0) + (S.lvk.lbw ?? 0)) / Math.max(1, S.credited)));
    tips.push({
      w: 7, title: "Bowl more wicket-taking balls",
      why: w.wk ? `One wicket every ${f1(w.sr)} balls against a league ${f1(LW.sr)}.` : `No wickets in ${ov(w.balls)} overs.`,
      next: `Attack the stumps more often. ${lst}% of all league wickets are bowled or LBW, so a straighter line brings the batter's mistakes into play. Add one change of pace each over.`,
      target: `A wicket every ${f0(LW.sr)} balls.`,
    });
  } else if (w.econ! <= LW.econ! * 0.9 && w.sr! >= (LW.sr ?? 0)) {
    tips.push({
      w: 5, title: "Turn control into wickets",
      why: `You're economical (${f2(w.econ)}) but take a wicket only every ${f1(w.sr)} balls (league ${f1(LW.sr)}).`,
      next: "You've earned the right to attack: bring a catcher up when the batter is tied down, and use your slower ball when he tries to break free.",
    });
  }
  const worst = opp.filter((o) => o.spells >= 2 && o.econ != null).sort((a, b) => b.econ! - a.econ!)[0];
  if (worst && worst.econ! >= w.econ! + 2) {
    tips.push({
      w: 6, title: `Plan for ${worst.label.replace(/^vs /, "")}`,
      why: `${f2(worst.econ)} an over against them, against ${f2(w.econ)} overall.`,
      next: "Study who scored off you in those games and set the field for their strong side before the first ball.",
    });
  }
  const threats = faced.filter((m) => m.inns >= 2 && !m.wk && (m.sr ?? 0) >= 170).sort((a, b) => (b.sr ?? 0) - (a.sr ?? 0)).slice(0, 3);
  if (threats.length) {
    tips.push({
      w: 5, title: "Have a plan for the danger men",
      why: `${threats.map((t) => `${S.d.players[t.p]} (SR ${f0(t.sr)})`).join(", ")} score freely in innings you bowl, and you haven't dismissed them.`,
      next: "Bowl to their weak side with a matching field, and save your best over for when they're on strike.",
    });
  }
  if (w.big >= 3 && w.big / w.spells >= 0.25) {
    tips.push({
      w: 4, title: "Limit the expensive overs",
      why: `${plural(w.big, "spell")} of 20+ runs out of ${w.spells}.`,
      next: "When an over starts going, go back to your stock ball. One boundary is fine; three in a row is the over that loses games.",
    });
  }
  if (chances.underusedBowl) {
    tips.push({
      w: 3, title: "Ask for more overs",
      why: `Economy ${f2(w.econ)} (league ${f2(LW.econ)}) but you bowl in ${f0(chances.bowlShare)}% of your matches.`,
      next: "Your numbers say you should bowl more. Take them to the captain.",
    });
  }
  if (!tips.length) {
    tips.push({
      w: 0, title: "Keep doing what works",
      why: `Economy ${f2(w.econ)} and a wicket every ${f1(w.sr)} balls, both better than the league.`,
      next: "Add one variation in the nets (a slower ball or a wider line) so batters can't line you up.",
    });
  }
  return tips.sort((a, b) => b.w - a.w).slice(0, 4).map((t): Tip => ({ title: t.title, why: t.why, next: t.next, target: t.target }));
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export type Attendance = {
  /** Main team, per season ("Vikings", or "NeuroStrikers → Vikings" across seasons). */
  team: string;
  /** Matches he played for his main team, out of every match that team played. */
  present: number;
  teamMatches: number;
  pct: number;
  /** Matches as a guest for another side in the same season. */
  guest: number;
  guestTeams: string[];
  matchdays: number;
  ofMatchdays: number;
};

/**
 * Worked out season by season: a move between seasons is a new main team, not a
 * guest spell. A match counts when he batted, bowled or was named in a
 * dismissal. CricHeroes doesn't list a player who did none of those, so this
 * can undercount slightly.
 */
export function attendanceFor(S: ScopeIndex, x: PlayerAgg): Attendance {
  const M = S.d.matches;
  const bySeason = new Map<number, Map<string, number>>();
  for (const [m, t] of x.matchTeam) {
    const s = bySeason.get(M[m].season) ?? bySeason.set(M[m].season, new Map()).get(M[m].season)!;
    s.set(t, (s.get(t) ?? 0) + 1);
  }
  let present = 0, teamMatches = 0, guest = 0;
  const mains: string[] = [];
  const guestTeams = new Set<string>();
  for (const season of [...bySeason.keys()].sort()) {
    const counts = [...bySeason.get(season)!.entries()].sort((a, b) => b[1] - a[1]);
    const [main, n] = counts[0];
    if (mains.at(-1) !== main) mains.push(main);
    present += n;
    teamMatches += S.matchIds.filter((m) => M[m].season === season && (M[m].teamA === main || M[m].teamB === main)).length;
    for (const [t, k] of counts.slice(1)) { guest += k; guestTeams.add(t); }
  }
  return {
    team: mains.join(" → "), present, teamMatches,
    pct: teamMatches ? Math.round((100 * present) / teamMatches) : 0,
    guest, guestTeams: [...guestTeams],
    matchdays: new Set([...x.matchIds].map((m) => M[m].date)).size,
    ofMatchdays: S.matchdays.length,
  };
}

// ─── Opportunity ─────────────────────────────────────────────────────────────

export type Chances = {
  matches: number;
  battedIn: number;
  bowledIn: number;
  ballsPerMatch: number;
  teamBallsPerMatch: number;
  oversPerMatch: number;
  bowlShare: number;
  avgPos: number | null;
  underusedBat: boolean;
  underusedBowl: boolean;
};

function chancesFor(S: ScopeIndex, x: PlayerAgg): Chances {
  // Team average: balls faced per player-appearance for this player's main team.
  const team = [...S.players.values()].filter((y) => y.team === x.team && y.matches > 0);
  const tBalls = team.reduce((s, y) => s + y.B.balls, 0);
  const tApps = team.reduce((s, y) => s + y.matches, 0);
  const battedIn = new Set(x.bat.map((r) => r.m)).size;
  const bowledIn = new Set(x.bowl.map((r) => r.m)).size;
  const ballsPerMatch = x.matches ? x.B.balls / x.matches : 0;
  const teamBallsPerMatch = tApps ? tBalls / tApps : 0;
  const bowlShare = x.matches ? (100 * bowledIn) / x.matches : 0;
  return {
    matches: x.matches,
    battedIn,
    bowledIn,
    ballsPerMatch,
    teamBallsPerMatch,
    oversPerMatch: x.matches ? x.W.balls / 6 / x.matches : 0,
    bowlShare,
    avgPos: x.bat.length ? x.bat.reduce((s, r) => s + r.pos, 0) / x.bat.length : null,
    underusedBat: x.matches >= 3 && x.B.balls >= 15 && (x.B.sr ?? 0) >= (S.LB.sr ?? 0) * 1.05 && ballsPerMatch < teamBallsPerMatch * 0.8,
    underusedBowl: x.matches >= 3 && x.W.balls >= 12 && (x.W.econ ?? 99) <= (S.LW.econ ?? 0) * 0.95 && bowlShare < 60,
  };
}

// ─── Player profile ──────────────────────────────────────────────────────────

export type Split = { label: string; inns: number; runs: number; balls: number; avg: number | null; sr: number | null };
export type BowlSplit = { label: string; spells: number; balls: number; runs: number; wk: number; econ: number | null; dotPct: number | null };
export type BatterMatchup = { p: number; inns: number; wk: number; balls: number; runs: number; dots: number; br: number; bb: number; econ: number | null; sr: number | null; dotPct: number | null };
export type BowlerMatchup = { p: number; inns: number; wk: number; ducks: number; br: number; bb: number; balls: number; runs: number; sr: number | null; econ: number | null };

const toSplit = (label: string, rows: Bat[]): Split => {
  const a = aggBat(rows);
  return { label, inns: a.inns, runs: a.runs, balls: a.balls, avg: a.avg, sr: a.sr };
};
const toBowlSplit = (label: string, rows: Bowl[]): BowlSplit => {
  const a = aggBowl(rows);
  return { label, spells: a.spells, balls: a.balls, runs: a.runs, wk: a.wk, econ: a.econ, dotPct: a.dotPct };
};
const byDate = (S: ScopeIndex) => (a: { m: number }, b: { m: number }) =>
  S.d.matches[a.m].date.localeCompare(S.d.matches[b.m].date) || a.m - b.m;

export type Profile = NonNullable<ReturnType<typeof playerProfile>>;

export function playerProfile(d: CardData, seasons: number[], p: number) {
  const S = getScope(d, seasons);
  const x = S.players.get(p);
  if (!x) return null;
  const M = d.matches;
  const b = x.B;

  // batting
  const outs = x.bat.filter((r) => isOut(r.kind));
  const count = (rows: Bat[], f: (r: Bat) => number) => {
    const m = new Map<number, number>();
    for (const r of rows) { const k = f(r); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, c) => c[1] - a[1]).map(([q, n]) => ({ p: q, n }));
  };
  const dismissedBy = count(outs, (r) => r.bw);
  const caughtBy = count(outs.filter((r) => r.kind === "c" || r.kind === "st"), (r) => r.fl[0] ?? -1);
  const kinds = KIND_ORDER.filter((k) => (b.kinds[k] ?? 0) || (S.lk[k] ?? 0) >= 3).map((k) => ({
    kind: k, label: KIND_LABEL[k], n: b.kinds[k] ?? 0, pct: pct(b.kinds[k] ?? 0, outs.length) ?? 0, league: pct(S.lk[k] ?? 0, S.outs) ?? 0,
  }));
  const duckCounts = Object.fromEntries(DUCKS.map((t) => [t.key, 0])) as Record<DuckType, number>;
  const duckList: { date: string; type: DuckType; opp: string; balls: number; how: string; season: number }[] = [];
  for (const r of [...x.bat].sort(byDate(S))) {
    const t = duckType(r);
    if (t) { duckCounts[t]++; duckList.push({ date: M[r.m].date, type: t, opp: r.opp, balls: r.balls, how: r.how, season: M[r.m].season }); }
  }
  const innTotal = (r: Bat) => d.innings.find((i) => i[0] === r.m && i[1] === r.inn)?.[3] ?? 0;
  const teamRuns = x.bat.reduce((s, r) => s + innTotal(r), 0);
  const log = [...x.bat].sort(byDate(S)).map((r) => ({
    date: M[r.m].date, season: M[r.m].season, runs: r.runs, balls: r.balls, f4: r.f4, s6: r.s6, out: isOut(r.kind), how: r.how,
    opp: r.opp, chasing: r.inn === 2, pos: r.pos, won: M[r.m].winner === r.team,
  }));
  const opps = [...new Set(x.bat.map((r) => r.opp))].sort();
  const positions = [...new Set(x.bat.map((r) => r.pos))].sort((a, c) => a - c);
  const seasonsIn = [...new Set([...x.bat, ...x.bowl].map((r) => M[r.m].season))].sort();

  const batterMatchups: BatterMatchup[] = (() => {
    const map = new Map<number, BatterMatchup>();
    for (const r of x.bat) {
      for (const w of S.byInnBowl.get(key(r.m, r.inn)) ?? []) {
        const e = map.get(w.p) ?? map.set(w.p, { p: w.p, inns: 0, wk: 0, balls: 0, runs: 0, dots: 0, br: 0, bb: 0, econ: null, sr: null, dotPct: null }).get(w.p)!;
        e.inns++; e.balls += w.balls; e.runs += w.runs; e.dots += w.dots; e.br += r.runs; e.bb += r.balls;
        if (r.bw === w.p) e.wk++;
      }
    }
    return [...map.values()]
      .map((e) => ({ ...e, econ: e.balls ? (6 * e.runs) / e.balls : null, sr: e.bb ? (100 * e.br) / e.bb : null, dotPct: e.balls ? (100 * e.dots) / e.balls : null }))
      .filter((e) => e.inns >= 2 || e.wk);
  })();

  // bowling
  const bowlerMatchups: BowlerMatchup[] = (() => {
    const map = new Map<number, BowlerMatchup>();
    for (const w of x.bowl) {
      for (const r of S.byInnBat.get(key(w.m, w.inn)) ?? []) {
        const e = map.get(r.p) ?? map.set(r.p, { p: r.p, inns: 0, wk: 0, ducks: 0, br: 0, bb: 0, balls: 0, runs: 0, sr: null, econ: null }).get(r.p)!;
        e.inns++; e.br += r.runs; e.bb += r.balls; e.balls += w.balls; e.runs += w.runs;
        if (r.bw === x.p) { e.wk++; if (duckType(r)) e.ducks++; }
      }
    }
    return [...map.values()]
      .map((e) => ({ ...e, sr: e.bb ? (100 * e.br) / e.bb : null, econ: e.balls ? (6 * e.runs) / e.balls : null }))
      .filter((e) => e.inns >= 2 || e.wk);
  })();
  const spells = [...x.bowl].sort(byDate(S)).map((r) => ({
    date: M[r.m].date, season: M[r.m].season, opp: r.opp, balls: r.balls, mdn: r.mdn, runs: r.runs, wk: r.wk, dots: r.dots, wd: r.wd, nb: r.nb,
    won: M[r.m].winner === r.team,
  }));
  const bowlOpps = [...new Set(x.bowl.map((r) => r.opp))].sort().map((o) => toBowlSplit(`vs ${o}`, x.bowl.filter((r) => r.opp === o)));
  const wickets = [...x.victims].sort(byDate(S)).map((r) => ({
    date: M[r.m].date, season: M[r.m].season, batter: d.players[r.p], batterTeam: r.team,
    score: `${r.runs} (${r.balls})`, kind: r.kind, how: r.how, duck: duckType(r),
    fow: r.fow ? `${ordinal(r.fow[0])} wkt · ${r.fow[1]}/${r.fow[0]} in ${r.fow[2]} ov` : "",
    phase: wicketPhase(r, M[r.m].overs),
    won: M[r.m].winner === r.opp,
  }));
  const vk: Partial<Record<CardKind, number>> = {};
  for (const r of x.victims) vk[r.kind] = (vk[r.kind] ?? 0) + 1;
  const victimKinds = (["c", "cb", "b", "lbw", "st"] as CardKind[])
    .filter((k) => vk[k] || (S.lvk[k] ?? 0) >= 3)
    .map((k) => ({ kind: k, label: KIND_LABEL[k], n: vk[k] ?? 0, pct: pct(vk[k] ?? 0, x.victims.length) ?? 0, league: pct(S.lvk[k] ?? 0, S.credited) ?? 0 }));

  const chances = chancesFor(S, x);
  const rank = (m: Map<number, Rank>) => m.get(p) ?? null;

  return {
    p, name: d.players[p], id: d.playerIds[p],
    nameOf: (q: number) => d.players[q] ?? "Unknown", teams: x.teams, team: x.team, role: x.role,
    matches: x.matches, seasonsIn,
    attendance: attendanceFor(S, x),
    B: b, W: x.W, F: x.F,
    league: { LB: S.LB, LW: S.LW, ld: S.ld, outs: S.outs },
    ranks: {
      runs: rank(S.ranks.runs), sr: rank(S.ranks.sr), six: rank(S.ranks.six), wk: rank(S.ranks.wk),
      econ: rank(S.ranks.econ), dot: rank(S.ranks.dot), field: rank(S.ranks.field),
      death: rank(S.ranks.death), pp: rank(S.ranks.pp),
    },
    insights: insights(S, x),
    tips: { batting: battingTips(S, x, chances), bowling: bowlingTips(S, x, chances, bowlOpps, bowlerMatchups) },
    dna: playerDna(S, x),
    badges: playerBadges(S, x),
    mom: (momCounts(d, seasons).get(p) ?? []).map((m) => ({ m, date: M[m].date, season: M[m].season, line: manOfTheMatch(d).get(m)!.line, opp: M[m].teamA === x.team ? M[m].teamB : M[m].teamA })),
    phase: x.phase,
    winPct: x.winPct,
    chances,
    batting: {
      outs: outs.length, kinds, dismissedBy, caughtBy,
      keeper: outs.filter((r) => r.keeper).length,
      firstWicket: outs.filter((r) => r.fow && r.fow[0] === 1).length,
      inFirstTwoOvers: outs.filter((r) => r.fow && parseFloat(r.fow[2]) <= 2).length,
      quick: outs.filter((r) => r.balls <= 6).length,
      ballsWhenOut: outs.map((r) => r.balls).sort((a, c) => a - c),
      duckCounts, duckList,
      log,
      first10: [toSplit("Under 10 balls", x.bat.filter((r) => r.balls < 10)), toSplit("10 balls or more", x.bat.filter((r) => r.balls >= 10))],
      situation: [
        toSplit("Batting first", x.bat.filter((r) => r.inn === 1)),
        toSplit("Chasing", x.bat.filter((r) => r.inn === 2)),
        toSplit("Team won", x.bat.filter((r) => M[r.m].winner === r.team)),
        toSplit("Team lost", x.bat.filter((r) => M[r.m].winner && M[r.m].winner !== r.team)),
      ],
      seasons: seasons.length > 1 ? seasons.map((s) => toSplit(`Season ${s}`, x.bat.filter((r) => M[r.m].season === s))) : [],
      opponents: opps.map((o) => toSplit(`vs ${o}`, x.bat.filter((r) => r.opp === o))),
      positions: positions.map((q) => toSplit(`#${q}`, x.bat.filter((r) => r.pos === q))),
      teamShare: pct(b.runs, teamRuns),
      matchups: batterMatchups,
    },
    bowling: {
      spells, opponents: bowlOpps,
      seasons: seasons.length > 1 ? seasons.map((s) => toBowlSplit(`Season ${s}`, x.bowl.filter((r) => M[r.m].season === s))) : [],
      wickets, victimKinds,
      ducksTaken: x.victims.filter((r) => duckType(r)).length,
      matchups: bowlerMatchups,
    },
    fielding: [...x.field].sort(byDate(S)).map((r) => ({
      date: M[r.m].date, batter: d.players[r.p], kind: r.kind, keeper: r.keeper, how: r.how,
    })),
  };
}

// ─── League insights ─────────────────────────────────────────────────────────

export type TeamDna = {
  team: string;
  played: number; won: number; lost: number;
  players: number;
  runRate: number | null; conceded: number | null;
  avgFirst: number | null;
  chase: [number, number]; defend: [number, number];
  boundaryPct: number | null; sixesPerMatch: number; ballsPerBoundary: number | null;
  dotPctBowled: number | null; widesPerMatch: number; wicketsPerMatch: number;
  howOut: { label: string; pct: number }[];
  topRunShare: number | null; topRunners: { p: number; runs: number }[];
  topWicketShare: number | null; topWicketTakers: { p: number; wk: number }[];
  catchesPerMatch: number; runOutsPerMatch: number;
  traits: string[];
};

export type AttendanceRow = Attendance & { p: number; teams: string[] };
export type ChanceRow = Chances & { p: number; team: string; sr: number | null; econ: number | null; balls: number; bowlBalls: number };
export type DnaRow = { p: number; team: string; role: PlayerAgg["role"]; tags: string[] };

export function leagueInsights(d: CardData, seasons: number[]) {
  const S = getScope(d, seasons);
  const M = d.matches;
  const ps = [...S.players.values()].filter((x) => x.matches > 0);

  const attendance: AttendanceRow[] = ps
    .map((x) => ({ ...attendanceFor(S, x), p: x.p, teams: x.teams }))
    .sort((a, b) => b.matchdays - a.matchdays || b.pct - a.pct || b.present - a.present || S.d.players[a.p].localeCompare(S.d.players[b.p]));

  const chances: ChanceRow[] = ps
    .filter((x) => x.B.inns || x.W.spells)
    .map((x) => ({ ...chancesFor(S, x), p: x.p, team: x.team, sr: x.B.sr, econ: x.W.econ, balls: x.B.balls, bowlBalls: x.W.balls }))
    .sort((a, b) => a.ballsPerMatch + a.oversPerMatch * 6 - (b.ballsPerMatch + b.oversPerMatch * 6));

  const dna: DnaRow[] = ps
    .map((x) => ({ p: x.p, team: x.team, role: x.role, tags: playerDna(S, x).tags }))
    .filter((r) => r.tags.length)
    .sort((a, b) => b.tags.length - a.tags.length || S.d.players[a.p].localeCompare(S.d.players[b.p]));

  const teamNames = [...new Set(S.innings.map((i) => i[2]))];
  const teams: TeamDna[] = teamNames.map((t) => {
    const ms = S.matchIds.filter((m) => M[m].teamA === t || M[m].teamB === t);
    const played = ms.length;
    const won = ms.filter((m) => M[m].winner === t).length;
    const lost = ms.filter((m) => M[m].winner && M[m].winner !== t).length;
    const batInn = S.innings.filter((i) => i[2] === t);
    const bowlInn = S.innings.filter((i) => i[2] !== t && ms.includes(i[0]));
    const rr = (inns: InningsTuple[]) => {
      const balls = inns.reduce((s, i) => s + i[5], 0);
      return balls ? (6 * inns.reduce((s, i) => s + i[3], 0)) / balls : null;
    };
    const first = batInn.filter((i) => i[1] === 1);
    const chaseMs = ms.filter((m) => S.innings.some((i) => i[0] === m && i[1] === 2 && i[2] === t));
    const defendMs = ms.filter((m) => S.innings.some((i) => i[0] === m && i[1] === 1 && i[2] === t));
    const tb = S.bat.filter((r) => r.team === t);
    const tw = S.bowl.filter((r) => r.team === t);
    const A = aggBat(tb), Wb = aggBowl(tw);
    const outs = tb.filter((r) => isOut(r.kind));
    const hk = (ks: CardKind[]) => Math.round((100 * outs.filter((r) => ks.includes(r.kind)).length) / Math.max(1, outs.length));
    const runsBy = new Map<number, number>();
    for (const r of tb) runsBy.set(r.p, (runsBy.get(r.p) ?? 0) + r.runs);
    const wkBy = new Map<number, number>();
    for (const r of tw) wkBy.set(r.p, (wkBy.get(r.p) ?? 0) + r.wk);
    const topRunners = [...runsBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, runs]) => ({ p, runs }));
    const topWicketTakers = [...wkBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, wk]) => ({ p, wk }));
    const fieldRows = S.bat.filter((r) => r.opp === t);
    const catches = fieldRows.filter((r) => r.kind === "c" || r.kind === "cb" || r.kind === "st").length;
    const runOuts = fieldRows.filter((r) => r.kind === "ro").length;
    const players = new Set([...tb.map((r) => r.p), ...tw.map((r) => r.p)]).size;
    const dna: TeamDna = {
      team: t, played, won, lost, players,
      runRate: rr(batInn), conceded: rr(bowlInn),
      avgFirst: first.length ? first.reduce((s, i) => s + i[3], 0) / first.length : null,
      chase: [chaseMs.filter((m) => M[m].winner === t).length, chaseMs.filter((m) => M[m].winner && M[m].winner !== t).length],
      defend: [defendMs.filter((m) => M[m].winner === t).length, defendMs.filter((m) => M[m].winner && M[m].winner !== t).length],
      boundaryPct: A.bndPct, sixesPerMatch: played ? A.s6 / played : 0, ballsPerBoundary: A.bpb,
      dotPctBowled: Wb.dotPct, widesPerMatch: played ? Wb.wd / played : 0, wicketsPerMatch: played ? Wb.wk / played : 0,
      howOut: [
        { label: "Caught", pct: hk(["c", "cb"]) },
        { label: "Bowled / LBW", pct: hk(["b", "lbw"]) },
        { label: "Run out", pct: hk(["ro"]) },
        { label: "Stumped", pct: hk(["st"]) },
      ],
      topRunShare: A.runs ? (100 * (topRunners[0]?.runs ?? 0)) / A.runs : null, topRunners,
      topWicketShare: Wb.wk ? (100 * (topWicketTakers[0]?.wk ?? 0)) / Wb.wk : null, topWicketTakers,
      catchesPerMatch: played ? catches / played : 0, runOutsPerMatch: played ? runOuts / played : 0,
      traits: [],
    };
    return dna;
  });
  // Traits compare each team with the others in the same scope.
  const avg = (f: (t: TeamDna) => number | null) => {
    const v = teams.map(f).filter((n): n is number => n != null);
    return v.reduce((s, n) => s + n, 0) / Math.max(1, v.length);
  };
  const aRR = avg((t) => t.runRate), aCon = avg((t) => t.conceded), aSix = avg((t) => t.sixesPerMatch), aDot = avg((t) => t.dotPctBowled);
  const aWd = avg((t) => t.widesPerMatch), aRo = avg((t) => t.runOutsPerMatch), aCt = avg((t) => t.catchesPerMatch);
  for (const t of teams) {
    if ((t.runRate ?? 0) >= aRR * 1.06) t.traits.push("Batting powerhouse");
    if ((t.conceded ?? 99) <= aCon * 0.94) t.traits.push("Miserly attack");
    if (t.sixesPerMatch >= aSix * 1.15) t.traits.push("Six-hitting side");
    if ((t.dotPctBowled ?? 0) >= aDot + 3) t.traits.push("Dot-ball squeeze");
    if (t.widesPerMatch >= aWd * 1.2) t.traits.push("Leaks wides");
    if (t.runOutsPerMatch >= aRo * 1.25 && t.runOutsPerMatch > 0) t.traits.push("Sharp run-out side");
    if (t.catchesPerMatch >= aCt * 1.12) t.traits.push("Catches win matches");
    if ((t.topRunShare ?? 0) >= 30) t.traits.push(`Leans on ${S.d.players[t.topRunners[0].p]}`);
    if (t.chase[0] + t.chase[1] >= 3 && t.chase[0] / (t.chase[0] + t.chase[1]) >= 0.65) t.traits.push("Strong chasers");
    if (t.defend[0] + t.defend[1] >= 3 && t.defend[0] / (t.defend[0] + t.defend[1]) >= 0.65) t.traits.push("Defend totals well");
    if (t.chase[0] + t.chase[1] >= 3 && t.chase[0] / (t.chase[0] + t.chase[1]) <= 0.35) t.traits.push("Struggle chasing");
  }
  teams.sort((a, b) => b.won / Math.max(1, b.played) - a.won / Math.max(1, a.played));

  const badges = ps
    .map((x) => ({ p: x.p, team: x.team, role: x.role, badges: playerBadges(S, x) }))
    .filter((r) => r.badges.length);

  const totalDucks = Object.values(S.ld).reduce((s, n) => s + (n ?? 0), 0);
  return {
    attendance, chances, teams, dna, badges,
    summary: {
      players: ps.length, matchdays: S.matchdays.length, matches: S.matchIds.length,
      ducks: totalDucks, ld: S.ld, LB: S.LB, LW: S.LW,
    },
  };
}

// ─── Leaderboards ────────────────────────────────────────────────────────────

export type BoardRow = {
  p: number; team: string; teams: string[]; matches: number;
  runs: number; balls: number; sr: number | null; avg: number | null; f4: number; s6: number; bnd: number;
  bpb: number | null; dotsFaced: number; dotFacedPct: number | null; ducks: number; t30: number;
  wk: number; bowlBalls: number; econ: number | null; dots: number; dotPct: number | null; wides: number; noBalls: number;
  maidens: number; death: number; powerplay: number; ducksTaken: number; hauls2: number;
  catches: number; runOuts: number; stumpings: number; fielding: number;
  mom: number;
};

export function leaderboardRows(d: CardData, seasons: number[]): BoardRow[] {
  const S = getScope(d, seasons);
  const moms = momCounts(d, seasons);
  return [...S.players.values()].filter((x) => x.matches > 0).map((x) => ({
    p: x.p, team: x.team, teams: x.teams, matches: x.matches,
    runs: x.B.runs, balls: x.B.balls, sr: x.B.sr, avg: x.B.avg, f4: x.B.f4, s6: x.B.s6, bnd: x.B.f4 + x.B.s6,
    bpb: x.B.bpb, dotsFaced: x.B.dots, dotFacedPct: x.B.dotPct, ducks: x.B.ducks, t30: x.B.t30,
    wk: x.W.wk, bowlBalls: x.W.balls, econ: x.W.econ, dots: x.W.dots, dotPct: x.W.dotPct, wides: x.W.wd, noBalls: x.W.nb,
    maidens: x.W.mdn, death: x.phase.death, powerplay: x.phase.powerplay,
    ducksTaken: x.victims.filter((r) => duckType(r)).length, hauls2: x.W.hauls2,
    catches: x.F.c, runOuts: x.F.ro, stumpings: x.F.st, fielding: x.F.total,
    mom: moms.get(x.p)?.length ?? 0,
  }));
}

// ─── All-Time XI ─────────────────────────────────────────────────────────────
// Strictly from the numbers: every player gets one impact score in runs, and
// a balanced side is filled slot by slot from the highest scores.
//
//   batting  = runs − balls × league runs-per-ball
//              − (dismissals − balls ÷ league balls-per-dismissal) × W
//   bowling  = balls × league runs-per-ball conceded − runs conceded
//              + (wickets − balls ÷ league balls-per-wicket) × W
//   fielding = fielding dismissals × W ÷ 4
//
// W, the value of a wicket, is half a league-average innings (batting average ÷ 2),
// the same whether a batter loses it or a bowler takes it.

export type XIRole = "Wicketkeeper" | "Opener" | "Middle order" | "All-rounder" | "Bowler";
export type Impact = { bat: number; bowl: number; field: number; total: number };
export type XIPick = {
  p: number;
  role: XIRole;
  team: string;
  teams: string[];
  matches: number;
  impact: Impact;
  line: string;
  why: string;
  captain?: boolean;
  vice?: boolean;
  alternatives: { p: number; total: number; score: number }[];
};

export function allTimeXI(d: CardData, seasons: number[]) {
  const S = getScope(d, seasons);
  const LB = S.LB, LW = S.LW;
  const lrpb = LB.balls ? LB.runs / LB.balls : 0;
  const lbpd = LB.outs ? LB.balls / LB.outs : 0;
  const wrpb = LW.balls ? LW.runs / LW.balls : 0;
  const wbpw = LW.wk ? LW.balls / LW.wk : 0;
  const W = (LB.avg ?? 0) / 2;

  const teamMatches = new Map<string, number>();
  for (const m of S.matchIds) for (const t of [d.matches[m].teamA, d.matches[m].teamB]) teamMatches.set(t, (teamMatches.get(t) ?? 0) + 1);
  const minMatches = Math.max(3, Math.round(0.3 * Math.max(0, ...teamMatches.values())));

  type C = PlayerAgg & { impact: Impact; avgPos: number | null; keep: number };
  const pool: C[] = [...S.players.values()]
    .filter((x) => x.matches >= minMatches)
    .map((x) => {
      const b = x.B, w = x.W;
      const bat = b.balls ? b.runs - b.balls * lrpb - (b.outs - (lbpd ? b.balls / lbpd : 0)) * W : 0;
      const bowl = w.balls ? w.balls * wrpb - w.runs + (w.wk - (wbpw ? w.balls / wbpw : 0)) * W : 0;
      const field = (x.F.total * W) / 4;
      return {
        ...x,
        impact: { bat, bowl, field, total: bat + bowl + field },
        avgPos: x.bat.length ? x.bat.reduce((s, r) => s + r.pos, 0) / x.bat.length : null,
        keep: x.F.kc + x.F.st,
      };
    });

  const taken = new Set<number>();
  const picks: XIPick[] = [];
  const line = (x: C) => {
    const bits: string[] = [];
    if (x.B.inns) bits.push(`${x.B.runs} runs @ SR ${f0(x.B.sr)}`);
    if (x.W.balls) bits.push(`${x.W.wk} wkts @ ${f2(x.W.econ)}`);
    if (x.F.total) bits.push(`${x.F.total} dismissals in the field`);
    return bits.join(" · ");
  };
  const pick = (role: XIRole, n: number, eligible: (x: C) => boolean, score: (x: C) => number, why: (x: C, rank: number) => string) => {
    const ranked = pool.filter((x) => !taken.has(x.p) && eligible(x)).sort((a, b) => score(b) - score(a));
    // Not enough specialists in a short season: fill from the best remaining players.
    const fallback = pool.filter((x) => !taken.has(x.p) && !ranked.includes(x)).sort((a, b) => b.impact.total - a.impact.total);
    const chosen = [...ranked, ...fallback].slice(0, n);
    const rest = ranked.slice(n, n + 3);
    chosen.forEach((x, i) => {
      taken.add(x.p);
      picks.push({
        p: x.p, role, team: x.team, teams: x.teams, matches: x.matches, impact: x.impact, line: line(x),
        why: ranked.includes(x) ? why(x, i + 1) : `No specialist ${role.toLowerCase()} qualified, so the best remaining player by total impact.`,
        alternatives: rest.map((y) => ({ p: y.p, total: y.impact.total, score: score(y) })),
      });
    });
  };
  const qb = (x: C) => x.B.balls >= MIN_BALLS;
  const qw = (x: C) => x.W.balls >= MIN_BALLS;
  const r1 = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(0);

  pick("Wicketkeeper", 1, (x) => x.keep >= (seasons.length > 1 ? 2 : 1), (x) => x.impact.total,
    (x) => `Best total impact (${r1(x.impact.total)}) of the ${plural(pool.filter((y) => y.keep >= (seasons.length > 1 ? 2 : 1)).length, "keeper")}; ${x.F.kc} catches and ${x.F.st} stumpings behind the stumps.`);
  pick("Opener", 2, (x) => qb(x) && (x.avgPos ?? 9) <= 2.5, (x) => x.impact.bat,
    (x, i) => `${i === 1 ? "Highest" : "Second-highest"} batting impact (${r1(x.impact.bat)}) among players who open or bat at 2.`);
  pick("All-rounder", 2, (x) => qb(x) && qw(x) && x.impact.bat > -W && x.impact.bowl > -W, (x) => x.impact.bat + x.impact.bowl,
    (x) => `Batting ${r1(x.impact.bat)} and bowling ${r1(x.impact.bowl)}: the best combined impact among players with 30+ balls in both.`);
  pick("Bowler", 4, qw, (x) => x.impact.bowl,
    (x, i) => `#${i} bowling impact (${r1(x.impact.bowl)}) of the remaining bowlers.`);
  pick("Middle order", 2, qb, (x) => x.impact.bat,
    (x, i) => `#${i} batting impact (${r1(x.impact.bat)}) of the remaining batters.`);

  // Captain and vice-captain: the two biggest total impacts in the side.
  const byTotal = [...picks].sort((a, b) => b.impact.total - a.impact.total);
  if (byTotal[0]) byTotal[0].captain = true;
  if (byTotal[1]) byTotal[1].vice = true;

  // Batting order: openers, middle order and keeper by where they actually bat, then all-rounders, then bowlers.
  const posOf = (q: XIPick) => pool.find((x) => x.p === q.p)?.avgPos ?? 9;
  const group: Record<XIRole, number> = { Opener: 0, "Middle order": 1, Wicketkeeper: 1, "All-rounder": 2, Bowler: 3 };
  const xi = picks.sort((a, b) => group[a.role] - group[b.role] || (group[a.role] === 3 ? b.impact.bat - a.impact.bat : posOf(a) - posOf(b)));

  const twelfth = pool.filter((x) => !taken.has(x.p)).sort((a, b) => b.impact.total - a.impact.total)[0];
  const bowlingOptions = xi.filter((q) => (S.players.get(q.p)?.W.balls ?? 0) >= MIN_BALLS).length;

  return {
    xi,
    twelfth: twelfth ? { p: twelfth.p, team: twelfth.team, impact: twelfth.impact, line: line(twelfth) } : null,
    method: { W, lrpb, lbpd, wrpb, wbpw, minMatches, pool: pool.length, bowlingOptions },
    totals: {
      bat: xi.reduce((s, q) => s + q.impact.bat, 0),
      bowl: xi.reduce((s, q) => s + q.impact.bowl, 0),
      field: xi.reduce((s, q) => s + q.impact.field, 0),
      teams: [...new Set(xi.map((q) => q.team))].map((t) => ({ team: t, n: xi.filter((q) => q.team === t).length })).sort((a, b) => b.n - a.n),
    },
  };
}

// ─── Match scorecard ─────────────────────────────────────────────────────────

export type ScorecardInnings = {
  inning: number;
  team: string;
  runs: number;
  wickets: number;
  balls: number;
  extras: { total: number; wides: number; noBalls: number; other: number };
  batting: { p: number; name: string; how: string; out: boolean; runs: number; balls: number; f4: number; s6: number; sr: number | null }[];
  fow: { wicket: number; score: number; over: string; p: number; name: string }[];
  bowling: { p: number; name: string; balls: number; mdn: number; runs: number; wk: number; dots: number; wd: number; nb: number; econ: number | null }[];
};

/** Full scorecard for one match, both innings, in the order CricHeroes listed them. */
export function matchScorecard(d: CardData, matchId: string) {
  const m = d.matches.findIndex((x) => x.id === matchId);
  if (m < 0) return null;
  const { bat, bowl } = decode(d);
  const innings: ScorecardInnings[] = d.innings
    .filter((i) => i[0] === m)
    .sort((a, b) => a[1] - b[1])
    .map((i) => {
      const inn = i[1];
      const batting = bat.filter((r) => r.m === m && r.inn === inn).sort((a, b) => a.pos - b.pos);
      const bowling = bowl.filter((r) => r.m === m && r.inn === inn);
      const wides = bowling.reduce((s, r) => s + r.wd, 0);
      const noBalls = bowling.reduce((s, r) => s + r.nb, 0);
      const extras = i[6] ?? 0;
      return {
        inning: inn, team: i[2], runs: i[3], wickets: i[4], balls: i[5],
        extras: { total: extras, wides, noBalls, other: Math.max(0, extras - wides - noBalls) },
        batting: batting.map((r) => ({
          p: r.p, name: d.players[r.p], how: r.how, out: isOut(r.kind), runs: r.runs, balls: r.balls, f4: r.f4, s6: r.s6,
          sr: r.balls ? (100 * r.runs) / r.balls : null,
        })),
        fow: batting
          .filter((r) => r.fow)
          .map((r) => ({ wicket: r.fow![0], score: r.fow![1], over: r.fow![2], p: r.p, name: d.players[r.p] }))
          .sort((a, b) => a.wicket - b.wicket),
        bowling: bowling.map((r) => ({
          p: r.p, name: d.players[r.p], balls: r.balls, mdn: r.mdn, runs: r.runs, wk: r.wk, dots: r.dots, wd: r.wd, nb: r.nb,
          econ: r.balls ? (6 * r.runs) / r.balls : null,
        })),
      };
    });
  return { match: d.matches[m], innings };
}

// ─── Player of the Match ─────────────────────────────────────────────────────
// CricHeroes' own award isn't in the export, so it's decided from the numbers,
// against the conditions of that match:
//
//   batting  = runs − balls × match runs-per-ball − dismissals × W
//   bowling  = balls × match runs-per-ball − runs conceded + wickets × W
//   fielding = fielding dismissals × W ÷ 4
//
// "Match runs-per-ball" is both innings combined, so a 90-run thrash and a
// 30-run scrap are judged on their own pitch. W is half the season's average
// innings per wicket. A positive score on the winning side counts 1.3×.

export type MoM = {
  m: number;
  p: number;
  team: string;
  score: number;
  impact: Impact;
  line: string;
  winner: boolean;
  runnerUp: { p: number; team: string; score: number; line: string } | null;
};

const momCache = new WeakMap<CardData, Map<number, MoM>>();

export function manOfTheMatch(d: CardData): Map<number, MoM> {
  const hit = momCache.get(d);
  if (hit) return hit;
  const { bat, bowl } = decode(d);
  const out = new Map<number, MoM>();
  const seasonW = new Map<number, number>();
  for (let m = 0; m < d.matches.length; m++) {
    const match = d.matches[m];
    const inns = d.innings.filter((i) => i[0] === m);
    const runs = inns.reduce((s, i) => s + i[3], 0);
    const balls = inns.reduce((s, i) => s + i[5], 0);
    if (!balls) continue;
    const rpb = runs / balls;
    const W = seasonW.get(match.season) ?? seasonW.set(match.season, (getScope(d, [match.season]).LB.avg ?? 14) / 2).get(match.season)!;
    const mb = bat.filter((r) => r.m === m);
    const mw = bowl.filter((r) => r.m === m);
    const scores = new Map<number, { team: string; impact: Impact; bits: string[] }>();
    const get = (p: number, team: string) => scores.get(p) ?? scores.set(p, { team, impact: { bat: 0, bowl: 0, field: 0, total: 0 }, bits: [] }).get(p)!;
    for (const r of mb) {
      const e = get(r.p, r.team);
      e.impact.bat += r.runs - r.balls * rpb - (isOut(r.kind) ? W : 0);
      e.bits.push(`${r.runs}${isOut(r.kind) ? "" : "*"} (${r.balls})`);
      for (const f of r.fl) if (f >= 0) get(f, r.opp).impact.field += W / 4;
    }
    for (const r of mw) {
      const e = get(r.p, r.team);
      e.impact.bowl += r.balls * rpb - r.runs + r.wk * W;
      e.bits.push(`${r.wk}/${r.runs} (${ov(r.balls)})`);
    }
    const ranked = [...scores.entries()]
      .map(([p, e]) => {
        e.impact.total = e.impact.bat + e.impact.bowl + e.impact.field;
        const won = match.winner === e.team;
        return { p, team: e.team, impact: e.impact, line: e.bits.join(" & "), winner: won, score: e.impact.total > 0 && won ? e.impact.total * 1.3 : e.impact.total };
      })
      .sort((a, b) => b.score - a.score);
    const [top, second] = ranked;
    if (!top) continue;
    out.set(m, { m, ...top, runnerUp: second ? { p: second.p, team: second.team, score: second.score, line: second.line } : null });
  }
  momCache.set(d, out);
  return out;
}

/** Player of the Match awards per player, within the given seasons. */
export function momCounts(d: CardData, seasons: number[]) {
  const c = new Map<number, number[]>();
  for (const [m, x] of manOfTheMatch(d)) {
    if (!seasons.includes(d.matches[m].season)) continue;
    (c.get(x.p) ?? c.set(x.p, []).get(x.p)!).push(m);
  }
  return c;
}

// ─── Player of the Match analytics ───────────────────────────────────────────

export type AwardType = "Batting" | "Bowling" | "All-round" | "Fielding";

export type Award = {
  m: number;
  matchId: string;
  date: string;
  season: number;
  p: number;
  team: string;
  opp: string;
  line: string;
  score: number;
  impact: Impact;
  type: AwardType;
  winner: boolean;
  /** How far clear of the runner-up, in impact runs. */
  margin: number;
  runnerUp: { p: number; team: string; score: number; line: string } | null;
  result: string;
};

/** What won it: 70%+ of the positive impact from one skill, otherwise all-round. */
function awardType(i: Impact): AwardType {
  const bat = Math.max(0, i.bat), bowl = Math.max(0, i.bowl), field = Math.max(0, i.field);
  const sum = bat + bowl + field || 1;
  if (bat / sum >= 0.7) return "Batting";
  if (bowl / sum >= 0.7) return "Bowling";
  if (field / sum >= 0.7) return "Fielding";
  return "All-round";
}

export function momAnalytics(d: CardData, seasons: number[]) {
  const S = getScope(d, seasons);
  const all = manOfTheMatch(d);
  const awards: Award[] = [...all.values()]
    .filter((x) => seasons.includes(d.matches[x.m].season))
    .map((x) => {
      const M = d.matches[x.m];
      return {
        m: x.m, matchId: M.id, date: M.date, season: M.season, p: x.p, team: x.team,
        opp: M.teamA === x.team ? M.teamB : M.teamA,
        line: x.line, score: x.score, impact: x.impact, type: awardType(x.impact), winner: x.winner,
        margin: x.runnerUp ? x.score - x.runnerUp.score : x.score,
        runnerUp: x.runnerUp,
        result: M.winner ? `${M.winner} won by ${M.winBy}` : "Match tied",
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.m - b.m);

  // Per player
  const players = new Map<number, { p: number; team: string; awards: Award[]; runnerUp: number; matches: number }>();
  const row = (p: number, team: string) =>
    players.get(p) ?? players.set(p, { p, team, awards: [], runnerUp: 0, matches: S.players.get(p)?.matches ?? 0 }).get(p)!;
  for (const a of awards) {
    row(a.p, S.players.get(a.p)?.team ?? a.team).awards.push(a);
    if (a.runnerUp) row(a.runnerUp.p, S.players.get(a.runnerUp.p)?.team ?? a.runnerUp.team).runnerUp++;
  }
  // Longest run of consecutive matches (his own) each ending with an award.
  const streak = (p: number) => {
    const ms = [...(S.players.get(p)?.matchIds ?? [])].sort((a, b) => d.matches[a].date.localeCompare(d.matches[b].date) || a - b);
    let best = 0, cur = 0;
    for (const m of ms) { if (all.get(m)?.p === p) best = Math.max(best, ++cur); else cur = 0; }
    return best;
  };
  const leaderboard = [...players.values()]
    .filter((r) => r.awards.length)
    .map((r) => ({
      p: r.p, team: r.team, awards: r.awards.length, matches: r.matches,
      rate: r.matches ? (100 * r.awards.length) / r.matches : 0,
      types: {
        Batting: r.awards.filter((a) => a.type === "Batting").length,
        Bowling: r.awards.filter((a) => a.type === "Bowling").length,
        "All-round": r.awards.filter((a) => a.type === "All-round").length,
        Fielding: r.awards.filter((a) => a.type === "Fielding").length,
      } as Record<AwardType, number>,
      runnerUp: r.runnerUp,
      best: [...r.awards].sort((a, b) => b.score - a.score)[0],
      streak: streak(r.p),
    }))
    .sort((a, b) => b.awards - a.awards || b.rate - a.rate || b.best.score - a.best.score);

  const nearlyMen = [...players.values()]
    .filter((r) => r.runnerUp >= 2)
    .map((r) => ({ p: r.p, team: r.team, runnerUp: r.runnerUp, awards: r.awards.length }))
    .sort((a, b) => b.runnerUp - a.runnerUp || a.awards - b.awards);

  const teams = [...new Set(awards.map((a) => a.team))]
    .map((t) => {
      const mine = awards.filter((a) => a.team === t);
      const played = S.matchIds.filter((m) => d.matches[m].teamA === t || d.matches[m].teamB === t).length;
      const winners = new Set(mine.map((a) => a.p)).size;
      return { team: t, awards: mine.length, played, share: awards.length ? (100 * mine.length) / awards.length : 0, winners };
    })
    .sort((a, b) => b.awards - a.awards);

  const types = (["Batting", "Bowling", "All-round", "Fielding"] as AwardType[]).map((t) => ({ type: t, n: awards.filter((a) => a.type === t).length }));
  const by = (f: (a: Award) => number) => [...awards].sort((a, b) => f(b) - f(a));

  const days = [...new Set(awards.map((a) => a.date))].sort().reverse().map((date) => ({ date, season: awards.find((a) => a.date === date)!.season, awards: awards.filter((a) => a.date === date) }));

  return {
    awards, leaderboard, nearlyMen, teams, types, days,
    records: {
      biggest: by((a) => a.score).slice(0, 5),
      dominant: by((a) => a.margin).slice(0, 5),
      closest: [...awards].filter((a) => a.runnerUp).sort((a, b) => a.margin - b.margin).slice(0, 5),
      batting: by((a) => a.impact.bat).slice(0, 3),
      bowling: by((a) => a.impact.bowl).slice(0, 3),
      losingSide: awards.filter((a) => !a.winner),
    },
    summary: {
      awards: awards.length,
      winners: leaderboard.length,
      fromWinningSide: awards.filter((a) => a.winner).length,
      topShare: leaderboard[0] ? (100 * leaderboard[0].awards) / Math.max(1, awards.length) : 0,
    },
  };
}
