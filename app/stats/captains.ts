// Captaincy records from the scorecards (see CaptainsTab.tsx).

import type { CardData } from "@/lib/scorecard-dashboard/profile";
import type { CaptaincyRow } from "@/lib/scorecard-dashboard/captaincy.server";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").trim();

export type Rec = { w: number; l: number; t: number };
const blank = (): Rec => ({ w: 0, l: 0, t: 0 });
export const played = (r: Rec) => r.w + r.l + r.t;

export type Captain = {
  p: number;
  teams: Map<string, number>;
  all: Rec;
  first: Rec; // batting first (defending)
  chase: Rec;
  toss: { won: number; lost: number; bat: number; bowl: number; wonThenWon: number; lostThenWon: number };
  vs: Map<string, Rec>;
  form: { runs: number; balls: number; wk: number; bowlBalls: number; conceded: number };
  bigRuns: { n: number; opp: string; date: string } | null;
  bigWkts: { n: number; opp: string; date: string } | null;
  streak: number;
  recent: ("W" | "L" | "T")[];
};

export function buildCaptains(d: CardData, seasons: number[], rows: CaptaincyRow[]) {
  const matchIndex = new Map(d.matches.map((m, i) => [m.id, i]));
  const idIndex = new Map(d.playerIds.map((id, i) => [id, i]));
  // Who appeared for whom in each match, to resolve a captain recorded by name.
  const present = new Map<string, number[]>();
  for (const [m, p, team] of d.present) (present.get(`${m}|${team}`) ?? present.set(`${m}|${team}`, []).get(`${m}|${team}`)!).push(p);
  const resolve = (m: number, row: CaptaincyRow): number | null => {
    if (row.captainId && idIndex.has(row.captainId)) return idIndex.get(row.captainId)!;
    if (!row.captainName) return null;
    const want = norm(row.captainName);
    const pool = present.get(`${m}|${row.team}`) ?? [];
    return pool.find((p) => norm(d.players[p]) === want) ?? pool.find((p) => norm(d.players[p]).split(" ")[0] === want.split(" ")[0]) ?? null;
  };

  const caps = new Map<number, Captain>();
  const get = (p: number) =>
    caps.get(p) ??
    caps.set(p, {
      p, teams: new Map(), all: blank(), first: blank(), chase: blank(),
      toss: { won: 0, lost: 0, bat: 0, bowl: 0, wonThenWon: 0, lostThenWon: 0 },
      vs: new Map(), form: { runs: 0, balls: 0, wk: 0, bowlBalls: 0, conceded: 0 },
      bigRuns: null, bigWkts: null, streak: 0, recent: [],
    }).get(p)!;

  const firstBat = new Map<number, string>();
  for (const [m, inn, team] of d.innings) if (inn === 1) firstBat.set(m, team);
  const ordered = [...rows]
    .map((r) => ({ r, m: matchIndex.get(r.matchId) }))
    .filter((x): x is { r: CaptaincyRow; m: number } => x.m != null && seasons.includes(d.matches[x.m].season))
    .sort((a, b) => d.matches[a.m].date.localeCompare(d.matches[b.m].date) || a.m - b.m);

  const runStreak = new Map<number, number>();
  for (const { r, m } of ordered) {
    const p = resolve(m, r);
    if (p == null) continue;
    const M = d.matches[m];
    const c = get(p);
    const opp = M.teamA === r.team ? M.teamB : M.teamA;
    const res: "W" | "L" | "T" = !M.winner ? "T" : M.winner === r.team ? "W" : "L";
    const add = (rec: Rec) => (res === "W" ? rec.w++ : res === "L" ? rec.l++ : rec.t++);
    add(c.all);
    add(firstBat.get(m) === r.team ? c.first : c.chase);
    add(c.vs.get(opp) ?? c.vs.set(opp, blank()).get(opp)!);
    c.teams.set(r.team, (c.teams.get(r.team) ?? 0) + 1);
    c.recent.push(res);
    const s = res === "W" ? (runStreak.get(p) ?? 0) + 1 : 0;
    runStreak.set(p, s);
    c.streak = Math.max(c.streak, s);
    if (res === "W") {
      const n = Number(M.winBy.match(/\d+/)?.[0] ?? 0);
      const pick = { n, opp, date: M.date };
      if (/run/.test(M.winBy) && n > (c.bigRuns?.n ?? 0)) c.bigRuns = pick;
      if (/wicket/.test(M.winBy) && n > (c.bigWkts?.n ?? 0)) c.bigWkts = pick;
    }
    if (r.toss) {
      if (r.toss === "won") {
        c.toss.won++;
        if (r.decision === "bat") c.toss.bat++;
        if (r.decision === "bowl") c.toss.bowl++;
        if (res === "W") c.toss.wonThenWon++;
      } else {
        c.toss.lost++;
        if (res === "W") c.toss.lostThenWon++;
      }
    }
    for (const b of d.bat) if (b[0] === m && b[2] === p) { c.form.runs += b[5]; c.form.balls += b[6]; }
    for (const w of d.bowl) if (w[0] === m && w[2] === p) { c.form.bowlBalls += w[5]; c.form.conceded += w[7]; c.form.wk += w[8]; }
  }
  return [...caps.values()].filter((c) => played(c.all) > 0).sort((a, b) => played(b.all) - played(a.all) || b.all.w - a.all.w);
}


const pctOf = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

/** The captaincy and toss badges: label, tone (for the Achievements look) and who holds it. */
export type CaptainAward = { label: string; tone: "crown" | "team" | "warn"; p: number; team: string; value: string; unit: string; why: string };

export function captainAwards(caps: Captain[]): CaptainAward[] {
  const team = (c: Captain) => [...c.teams.keys()][0] ?? "";
  const tossers = caps.filter((c) => c.toss.won + c.toss.lost > 0);
  const skipper = [...caps].filter((c) => played(c.all) >= 4).sort((a, b) => b.all.w - a.all.w || b.all.w / played(b.all) - a.all.w / played(a.all))[0];
  const winRate = [...caps].filter((c) => played(c.all) >= 6).sort((a, b) => b.all.w / played(b.all) - a.all.w / played(a.all))[0];
  const chaser = [...caps].filter((c) => played(c.chase) >= 3).sort((a, b) => b.chase.w / played(b.chase) - a.chase.w / played(a.chase) || b.chase.w - a.chase.w)[0];
  const defender = [...caps].filter((c) => played(c.first) >= 3).sort((a, b) => b.first.w / played(b.first) - a.first.w / played(a.first) || b.first.w - a.first.w)[0];
  const tossKing = [...tossers].sort((a, b) => b.toss.won - a.toss.won)[0];
  const whisperer = [...tossers].filter((c) => c.toss.won + c.toss.lost >= 4).sort((a, b) => b.toss.won / (b.toss.won + b.toss.lost) - a.toss.won / (a.toss.won + a.toss.lost) || b.toss.won - a.toss.won)[0];
  const converter = [...tossers].filter((c) => c.toss.won >= 3).sort((a, b) => b.toss.wonThenWon / b.toss.won - a.toss.wonThenWon / a.toss.won)[0];
  const jinx = [...tossers].sort((a, b) => b.toss.lost - a.toss.lost)[0];
  return [
    skipper && { label: "Skipper Supreme", tone: "crown" as const, p: skipper.p, team: team(skipper), value: String(skipper.all.w), unit: "wins as captain", why: `${skipper.all.w} wins in ${played(skipper.all)} matches as captain.` },
    winRate && winRate !== skipper && { label: "Winning Habit", tone: "team" as const, p: winRate.p, team: team(winRate), value: `${pctOf(winRate.all.w, played(winRate.all))}%`, unit: "win rate as captain", why: `Wins ${pctOf(winRate.all.w, played(winRate.all))}% as captain (min 6).` },
    chaser && { label: "Chase Captain", tone: "team" as const, p: chaser.p, team: team(chaser), value: `${chaser.chase.w}/${played(chaser.chase)}`, unit: "chases won", why: `Won ${chaser.chase.w} of ${played(chaser.chase)} chases as captain (min 3).` },
    defender && { label: "Fortress Captain", tone: "team" as const, p: defender.p, team: team(defender), value: `${defender.first.w}/${played(defender.first)}`, unit: "totals defended", why: `Defended ${defender.first.w} of ${played(defender.first)} totals as captain (min 3).` },
    tossKing && { label: "Toss King", tone: "crown" as const, p: tossKing.p, team: team(tossKing), value: String(tossKing.toss.won), unit: "tosses won", why: `Won ${tossKing.toss.won} of ${tossKing.toss.won + tossKing.toss.lost} tosses.` },
    whisperer && { label: "Coin Whisperer", tone: "team" as const, p: whisperer.p, team: team(whisperer), value: `${pctOf(whisperer.toss.won, whisperer.toss.won + whisperer.toss.lost)}%`, unit: "tosses won", why: `Called it right ${whisperer.toss.won} times in ${whisperer.toss.won + whisperer.toss.lost} (min 4).` },
    converter && { label: "Toss Converter", tone: "team" as const, p: converter.p, team: team(converter), value: `${pctOf(converter.toss.wonThenWon, converter.toss.won)}%`, unit: "won after winning the toss", why: `Won ${converter.toss.wonThenWon} of ${converter.toss.won} matches after winning the toss (min 3).` },
    jinx && { label: "Toss Jinx", tone: "warn" as const, p: jinx.p, team: team(jinx), value: String(jinx.toss.lost), unit: "tosses lost", why: `Lost ${jinx.toss.lost} of ${jinx.toss.won + jinx.toss.lost} tosses.` },
  ].filter((x): x is CaptainAward => !!x);
}
