// Boundary Banter matchday reports, written from the CricHeroes scorecard export.
//
// One article per match day (a season's week), covering every game played
// that day. Generated from lib/scorecard-dashboard/data.json, so a new export
// (scripts/build-scorecard-dashboard.mjs) publishes that week's article on the
// next deploy with no one writing or uploading anything.
//
// Every number in an article comes from the scorecard. The voice comes from
// the phrase pools below; which variant is used is seeded by the match ID (or
// the day, for day-level lines), so an article reads the same on every build
// until the scorecard itself changes.
//
// Player identity (merged IDs, canonical names) is the dashboard's: this file
// reads buildCardData() and never the raw export. Rankings follow the IPL
// convention used sitewide: batting runs → strike rate, bowling wickets →
// economy. Standings use the site's points-table rule (points % then NRR).

import { buildCardData } from "@/lib/scorecard-dashboard/compute";
import { manOfTheMatch, ov, type CardData, type CardKind } from "@/lib/scorecard-dashboard/profile";

// ─── Output shapes ───────────────────────────────────────────────────────────

export type ReportBat = {
  name: string;
  how: string;
  out: boolean;
  runs: number;
  balls: number;
  f4: number;
  s6: number;
};
export type ReportBowl = { name: string; balls: number; mdn: number; runs: number; wk: number; dots: number };
export type ReportInnings = {
  team: string;
  runs: number;
  wickets: number;
  balls: number;
  extras: number;
  batting: ReportBat[];
  bowling: ReportBowl[];
  fow: { wicket: number; score: number; over: string; name: string }[];
};
export type TableRow = {
  team: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  nrr: number;
  /** Places gained (+) or lost (−) over the day. */
  moved: number;
};
/** One game inside a matchday article. */
export type DayMatch = {
  matchNo: number;
  kicker: string;
  headline: string;
  winner: string | null;
  result: string;
  overs: number;
  innings: ReportInnings[];
  paragraphs: string[];
  potm: { name: string; team: string; line: string } | null;
};
export type DayReport = {
  slug: string;
  season: number;
  week: number;
  date: string;
  venue: string;
  kicker: string;
  headline: string;
  dek: string;
  byline: string;
  lede: string[];
  matches: DayMatch[];
  records: string[];
  star: { name: string; team: string; line: string; blurb: string } | null;
  numbers: { value: string; label: string }[];
  verdict: string;
  table: TableRow[];
  prev: { slug: string; headline: string } | null;
  next: { slug: string; headline: string } | null;
};
export type DayPreview = Pick<DayReport, "slug" | "season" | "week" | "date" | "venue" | "kicker" | "headline" | "dek"> & {
  matches: { kicker: string; winner: string | null; scores: { team: string; runs: number; wickets: number; balls: number }[] }[];
  star: string | null;
};

// ─── Small helpers ───────────────────────────────────────────────────────────

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const sr = (runs: number, balls: number) => (balls ? Math.round((100 * runs) / balls) : 0);
const econ = (runs: number, balls: number) => (balls ? (6 * runs) / balls : 0);
const fmtEcon = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
const score = (i: { runs: number; wickets: number }) => `${i.runs}/${i.wickets}`;
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => WORDS[n] ?? String(n);
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >> 3) ^ 1 && n % 10] || "th"}`;
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekday = (iso: string) => DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

/** "The Outliers" mid-sentence is "the Outliers"; the others carry no article. */
const team = (t: string) => t.replace(/^The /, "the ");
const Team = (t: string) => capFirst(t);
/** Possessive: "Mavericks'", "Rudraksh's". */
const poss = (s: string) => (s.endsWith("s") ? `${s}'` : `${s}'s`);

/** CricHeroes venue names drift ("Box Cricket Kodai", "Kodai Box Cricket 2"). */
function venueName(v: string) {
  if (/kodai/i.test(v)) return "Kodai Box Cricket";
  if (/heera/i.test(v)) return "Heera Box Cricket";
  if (/jai club/i.test(v)) return "Jai Club Box";
  return v.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Deterministic per-match randomness: same match ID, same words. */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Decoding CardData ───────────────────────────────────────────────────────

type Bat = {
  p: number; team: string; runs: number; balls: number; f4: number; s6: number;
  kind: CardKind; bw: number; fl: number[]; keeper: boolean; pos: number;
  fow: [number, number, string] | null;
};
type Bowl = { p: number; team: string; balls: number; mdn: number; runs: number; wk: number; dots: number; wd: number; nb: number };
type Inn = { inning: number; team: string; opp: string; runs: number; wickets: number; balls: number; extras: number; bat: Bat[]; bowl: Bowl[] };

const isOut = (k: CardKind) => k !== "no";

function howOut(d: CardData, b: Bat): string {
  const n = (p: number) => (p >= 0 ? d.players[p] : "");
  const f = b.fl.map(n).filter(Boolean);
  const keeper = b.keeper ? "†" : "";
  switch (b.kind) {
    case "no": return "not out";
    case "c": return `c ${keeper}${f[0] ?? "sub"} b ${n(b.bw)}`;
    case "cb": return `c & b ${n(b.bw)}`;
    case "st": return `st ${keeper}${f[0] ?? ""} b ${n(b.bw)}`;
    case "lbw": return `lbw b ${n(b.bw)}`;
    case "b": return `b ${n(b.bw)}`;
    case "ro": return f.length ? `run out (${f.join(" / ")})` : "run out";
    case "hw": return `hit wicket b ${n(b.bw)}`;
    case "rt": return "retired out";
    default: return "out";
  }
}

function inningsOf(d: CardData, m: number): Inn[] {
  return d.innings
    .filter((i) => i[0] === m)
    .sort((a, b) => a[1] - b[1])
    .map((i) => {
      const bat = d.bat
        .filter((r) => r[0] === m && r[1] === i[1])
        .map((r): Bat => ({
          p: r[2], team: r[3], runs: r[5], balls: r[6], f4: r[7], s6: r[8],
          kind: r[9], bw: r[10], fl: r[11], keeper: r[12] === 1, pos: r[13], fow: r[14],
        }))
        .sort((a, b) => a.pos - b.pos);
      const bowl = d.bowl
        .filter((r) => r[0] === m && r[1] === i[1])
        .map((r): Bowl => ({ p: r[2], team: r[3], balls: r[5], mdn: r[6], runs: r[7], wk: r[8], dots: r[9], wd: r[10], nb: r[11] }));
      const match = d.matches[m];
      return {
        inning: i[1], team: i[2], opp: i[2] === match.teamA ? match.teamB : match.teamA,
        runs: i[3], wickets: i[4], balls: i[5], extras: i[6], bat, bowl,
      };
    });
}

// IPL order: batting runs → strike rate; bowling wickets → economy → runs.
const byBat = (a: Bat, b: Bat) => b.runs - a.runs || sr(b.runs, b.balls) - sr(a.runs, a.balls);
const byBowl = (a: Bowl, b: Bowl) => b.wk - a.wk || econ(a.runs, a.balls) - econ(b.runs, b.balls) || a.runs - b.runs;

/** Biggest stand from the fall of wickets, including an unbroken last one. */
function bestStand(inn: Inn): { runs: number; wicket: number; unbroken: boolean } | null {
  const falls = inn.bat.filter((b) => b.fow).map((b) => b.fow!).sort((a, b) => a[0] - b[0]);
  let prev = 0;
  let best: { runs: number; wicket: number; unbroken: boolean } | null = null;
  for (const [w, s] of falls) {
    if (!best || s - prev > best.runs) best = { runs: s - prev, wicket: w, unbroken: false };
    prev = s;
  }
  const last = inn.runs - prev;
  if (!best || last > best.runs) best = { runs: last, wicket: falls.length + 1, unbroken: true };
  return best;
}

/** Three or more wickets for eight runs or fewer. */
function collapse(inn: Inn): { lost: number; runs: number; from: number; to: number } | null {
  const falls = inn.bat.filter((b) => b.fow).map((b) => b.fow!).sort((a, b) => a[0] - b[0]);
  let best: { lost: number; runs: number; from: number; to: number } | null = null;
  for (let i = 0; i < falls.length; i++) {
    for (let j = i + 2; j < falls.length; j++) {
      const before = i === 0 ? 0 : falls[i - 1][1];
      const runs = falls[j][1] - before;
      const lost = j - i + 1;
      if (runs <= 8 && (!best || lost > best.lost)) best = { lost, runs, from: before, to: falls[j][1] };
    }
  }
  return best;
}

// ─── Season context ──────────────────────────────────────────────────────────

type Rec = { team: string; played: number; won: number; lost: number; tied: number; points: number; rf: number; bf: number; ra: number; ba: number; form: ("W" | "L" | "T")[] };

function standings(recs: Map<string, Rec>): TableRow[] {
  const pct = (r: Rec) => (r.played ? r.points / (r.played * 2) : 0);
  const nrr = (r: Rec) => (r.bf ? r.rf / (r.bf / 6) : 0) - (r.ba ? r.ra / (r.ba / 6) : 0);
  return [...recs.values()]
    .sort((a, b) => pct(b) - pct(a) || nrr(b) - nrr(a))
    .map((r) => ({
      team: r.team, played: r.played, won: r.won, lost: r.lost, tied: r.tied, points: r.points,
      nrr: Math.round(nrr(r) * 1000) / 1000,
      moved: 0,
    }));
}

function streak(form: ("W" | "L" | "T")[]) {
  const last = form.at(-1);
  let n = 0;
  for (let i = form.length - 1; i >= 0 && form[i] === last; i--) n++;
  return { kind: last, n };
}

// ─── Writing ─────────────────────────────────────────────────────────────────

const BYLINES = [
  "The Boundary Desk",
  "Our Correspondent at Long-On",
  "The Third Umpire",
  "From the Scorer's Hut",
  "Deep Square Leg Bureau",
  "The Pavilion Gossip Column",
];

type Ctx = {
  d: CardData;
  r: () => number;
  seen: Set<number>;
  firstNames: Map<string, number>;
};

function pick<T>(c: Ctx, xs: T[]): T {
  return xs[Math.floor(c.r() * xs.length)];
}

/** Full name on first mention, first name after — unless that's ambiguous in this match. */
function nm(c: Ctx, p: number): string {
  const full = c.d.players[p];
  if (!c.seen.has(p)) {
    c.seen.add(p);
    return full;
  }
  const first = full.split(" ")[0];
  return (c.firstNames.get(first.toLowerCase()) ?? 0) > 1 ? full : first;
}

/** "41* (19) & 0/14 (2)" → "41* off 19 balls and 0/14 from 2 overs". */
function proseLine(line: string) {
  return line
    .split(" & ")
    .map((bit) => {
      const bat = bit.match(/^(\d+\*?) \((\d+)\)$/);
      if (bat) return `${bat[1]} off ${plural(Number(bat[2]), "ball")}`;
      const bowl = bit.match(/^(\d+\/\d+) \(([\d.]+)\)$/);
      if (bowl) return `${bowl[1]} from ${bowl[2]} ${bowl[2] === "1" ? "over" : "overs"}`;
      return bit;
    })
    .join(" and ");
}

function batLine(b: Bat) {
  return `${b.runs}${isOut(b.kind) ? "" : "*"} off ${plural(b.balls, "ball")}`;
}
function boundaries(b: Bat) {
  const parts = [];
  if (b.s6) parts.push(plural(b.s6, "six", "sixes"));
  if (b.f4) parts.push(plural(b.f4, "four"));
  return parts.join(" and ");
}
function figures(b: Bowl) {
  return `${b.wk}/${b.runs} from ${ov(b.balls)} ${b.balls === 6 ? "over" : "overs"}`;
}

function describeBatter(c: Ctx, b: Bat, role: "top" | "support"): string {
  const s = sr(b.runs, b.balls);
  const name = nm(c, b.p);
  const bnd = boundaries(b);
  const withBnd = bnd ? `, with ${bnd}` : "";
  if (role === "support") {
    return pick(c, [
      `${name} chipped in with ${batLine(b)}${withBnd}.`,
      `Support came from ${name}, whose ${b.runs}${isOut(b.kind) ? "" : "*"} took ${plural(b.balls, "ball")}.`,
      `${name} added a useful ${b.runs}${isOut(b.kind) ? "" : "*"} (${b.balls}).`,
    ]);
  }
  if (s >= 200 && b.balls >= 8) {
    return pick(c, [
      `${name} treated the bowling with open contempt: ${batLine(b)}${withBnd}, a strike rate of ${s}.`,
      `${name} was in no mood for subtlety, clattering ${batLine(b)}${withBnd} at a strike rate of ${s}.`,
      `The innings belonged to ${name}, whose ${batLine(b)}${withBnd}${bnd ? "," : ""} came at a strike rate of ${s}.`,
    ]);
  }
  if (s < 100 && b.balls >= 10) {
    return pick(c, [
      `${name} top-scored with ${batLine(b)}, an innings more anchor than accelerator.`,
      `${name} held one end together for ${batLine(b)}, though a strike rate of ${s} left the scoring to others.`,
    ]);
  }
  return pick(c, [
    `${name} led the way with ${batLine(b)}${withBnd}.`,
    `${name} was the pick of the batters, making ${batLine(b)}${withBnd}.`,
    `The backbone was ${poss(name)} ${batLine(b)}${withBnd}.`,
  ]);
}

function describeBowler(c: Ctx, b: Bowl, batting: string): string {
  const name = nm(c, b.p);
  const e = econ(b.runs, b.balls);
  if (b.wk >= 3) {
    return pick(c, [
      `${name} did the damage for ${team(b.team)}, finishing with ${figures(b)}.`,
      `${name} ripped through ${team(batting)} with ${figures(b)}.`,
      `With ${figures(b)}, ${name} made sure ${team(batting)} never settled.`,
    ]);
  }
  if (e <= 6 && b.balls >= 12) {
    return pick(c, [
      `${name} was the miser of the innings, ${figures(b)} at ${fmtEcon(e)} an over.`,
      `Nobody got ${name} away: ${figures(b)}, ${plural(b.dots, "dot ball")} among them.`,
    ]);
  }
  return pick(c, [
    `${name} was the pick of the ${team(b.team)} attack with ${figures(b)}.`,
    `For ${team(b.team)}, ${name} returned ${figures(b)}.`,
  ]);
}

function firstInnings(c: Ctx, inn: Inn, maxBalls: number): string[] {
  const paras: string[] = [];
  const s: string[] = [];
  const bats = [...inn.bat].sort(byBat);
  const top = bats[0];
  const second = bats[1];
  const firstFall = inn.bat.map((b) => b.fow).filter(Boolean).sort((a, b) => a![0] - b![0])[0];

  if (firstFall && firstFall[0] === 1 && Number(firstFall[2]) < 1) {
    const gone = inn.bat.find((b) => b.fow?.[0] === 1)!;
    s.push(pick(c, [
      `${Team(inn.team)} lost ${nm(c, gone.p)} inside the first over, ${firstFall[1]}/1 before anyone had found their feet.`,
      `It started badly for ${team(inn.team)}: ${nm(c, gone.p)} was gone in the first over with ${plural(firstFall[1], "run")} on the board.`,
    ]));
  } else if (!firstFall || Number(firstFall[2]) >= 3) {
    s.push(pick(c, [
      `${poss(Team(inn.team))} openers gave them a platform, the first wicket not falling until ${firstFall ? `the ${ordinal(Math.floor(Number(firstFall[2])) + 1)} over at ${firstFall[1]}` : "never"}.`,
      `${Team(inn.team)} batted first and got through the early overs unscathed${firstFall ? `, ${firstFall[1]}/0 before the first breakthrough` : ""}.`,
    ]));
  } else {
    s.push(pick(c, [`${Team(inn.team)} batted first.`, `${Team(inn.team)} were asked to set the target.`]));
  }

  if (top) s.push(describeBatter(c, top, "top"));
  if (second && second.runs >= 10) s.push(describeBatter(c, second, "support"));

  const stand = bestStand(inn);
  if (stand && stand.runs >= 25) {
    s.push(stand.unbroken
      ? `An unbroken stand of ${stand.runs} at the end did most of the lifting.`
      : `The ${ordinal(stand.wicket)}-wicket stand was worth ${stand.runs}, the innings' best.`);
  }
  const fall = collapse(inn);
  if (fall) {
    s.push(pick(c, [
      `Then the wheels came off: ${word(fall.lost)} wickets went down for ${plural(fall.runs, "run")}, ${fall.from} becoming ${fall.to}/${inn.bat.filter((b) => b.fow && b.fow[1] <= fall.to).length}.`,
      `A wobble cost them dearly, ${word(fall.lost)} wickets falling for ${plural(fall.runs, "run")}.`,
    ]));
  }
  const allOut = inn.bat.length > 0 && inn.bat.every((b) => isOut(b.kind));
  s.push(allOut
    ? `They were all out for ${inn.runs} in ${ov(inn.balls)} overs.`
    : inn.balls >= maxBalls
      ? pick(c, [`They closed on ${score(inn)} from their ${maxBalls / 6} overs.`, `${Team(inn.team)} finished on ${score(inn)}.`])
      : `They finished on ${score(inn)} in ${ov(inn.balls)} overs.`);
  paras.push(s.join(" "));

  const bowl = [...inn.bowl].sort(byBowl);
  const t: string[] = [];
  if (bowl[0]) t.push(describeBowler(c, bowl[0], inn.team));
  const miser = inn.bowl.filter((b) => b !== bowl[0] && b.balls >= 12 && econ(b.runs, b.balls) <= 6).sort((a, b) => econ(a.runs, a.balls) - econ(b.runs, b.balls))[0];
  if (miser) t.push(`${nm(c, miser.p)} kept things tight too, ${plural(miser.runs, "run")} from ${ov(miser.balls)} overs.`);
  if (inn.extras >= 8) {
    t.push(pick(c, [
      `${Team(inn.opp)} will not enjoy the replay of the ${inn.extras} extras they conceded.`,
      `${plural(inn.extras, "extra")} in a ${maxBalls / 6}-over innings is a gift no fielding side should be wrapping.`,
    ]));
  }
  if (t.length) paras.push(t.join(" "));
  return paras;
}

function secondInnings(c: Ctx, inn: Inn, target: number, maxBalls: number, won: boolean | null): string[] {
  const s: string[] = [];
  const rrr = ((target / maxBalls) * 6).toFixed(1);
  s.push(pick(c, [
    `${Team(inn.team)} needed ${target} at ${rrr} an over.`,
    `The equation for ${team(inn.team)}: ${target} to win from ${maxBalls / 6} overs.`,
    `Chasing ${target}, ${team(inn.team)} needed a shade over ${Math.floor(Number(rrr))} an over.`,
  ]));

  const bats = [...inn.bat].sort(byBat);
  const top = bats[0];
  const fall = collapse(inn);
  const firstFall = inn.bat.map((b) => b.fow).filter(Boolean).sort((a, b) => a![0] - b![0])[0];
  if (firstFall && firstFall[0] === 1 && Number(firstFall[2]) < 1) {
    const gone = inn.bat.find((b) => b.fow?.[0] === 1)!;
    s.push(`${nm(c, gone.p)} fell in the first over, which is never the start a chase wants.`);
  }
  if (top) s.push(describeBatter(c, top, "top"));
  if (bats[1] && bats[1].runs >= 10) s.push(describeBatter(c, bats[1], "support"));
  if (fall) {
    s.push(`The chase lurched when ${word(fall.lost)} wickets fell for ${plural(fall.runs, "run")}.`);
  }
  const left = maxBalls - inn.balls;
  if (won === true) {
    s.push(left <= 2
      ? pick(c, [
        `They got there with ${left ? plural(left, "ball") + " to spare" : "the final ball of the match"}, which is to say barely.`,
        `It went to the wire, and they crossed the line with ${left ? plural(left, "ball") : "no balls"} left.`,
      ])
      : left >= 10
        ? pick(c, [`It was done with ${plural(left, "ball")} to spare.`, `They strolled home with ${ov(left)} overs unused.`])
        : `They reached ${score(inn)} with ${plural(left, "ball")} to spare.`);
  } else if (won === false) {
    const short = target - 1 - inn.runs;
    s.push(short <= 5
      ? `They finished on ${score(inn)}, ${plural(short + 1, "run")} short of the target and agonisingly close.`
      : pick(c, [`They ended on ${score(inn)}, well short.`, `The chase petered out at ${score(inn)}.`]));
  } else {
    s.push(`They finished on ${score(inn)} — level, to the run.`);
  }

  const paras = [s.join(" ")];
  const bowl = [...inn.bowl].sort(byBowl);
  const t: string[] = [];
  if (bowl[0]) t.push(describeBowler(c, bowl[0], inn.team));
  if (bowl[1] && bowl[1].wk >= 2) t.push(`${nm(c, bowl[1].p)} backed it up with ${figures(bowl[1])}.`);
  if (inn.extras >= 8) t.push(`${Team(inn.opp)} conceded ${inn.extras} extras along the way.`);
  if (t.length) paras.push(t.join(" "));
  return paras;
}


/** Roast material from one match, ranked: lower rank wins the day's verdict. */
function roasts(d: CardData, inns: Inn[]): { rank: number; lines: string[] }[] {
  const n = (p: number) => d.players[p];
  const all = inns.flatMap((i) => i.bat);
  const golden = all.find((b) => b.runs === 0 && b.balls <= 1 && isOut(b.kind) && b.kind !== "rt");
  const bowl = inns.flatMap((i) => i.bowl);
  const pricey = bowl.filter((b) => b.balls >= 6 && econ(b.runs, b.balls) >= 15).sort((a, b) => econ(b.runs, b.balls) - econ(a.runs, a.balls))[0];
  const maiden = bowl.find((b) => b.mdn > 0);
  const sixes = all.reduce((s, b) => s + b.s6, 0);
  const extras = inns.reduce((s, i) => s + i.extras, 0);
  const out: { rank: number; lines: string[] }[] = [];
  if (golden) out.push({ rank: 1, lines: [
    `A golden duck for ${n(golden.p)}. One ball, one walk back, zero regrets — we're told the bat is still in mint condition.`,
    `${n(golden.p)} faced one ball and left. Efficient, if nothing else.`,
  ] });
  if (pricey) out.push({ rank: 2, lines: [
    `${n(pricey.p)} went for ${plural(pricey.runs, "run")} in ${ov(pricey.balls)} ${pricey.balls === 6 ? "over" : "overs"}. The nets are open on Tuesday, and so, apparently, was the boundary.`,
    `Somebody check on ${n(pricey.p)}: ${pricey.runs} off ${ov(pricey.balls)}, an economy of ${fmtEcon(econ(pricey.runs, pricey.balls))}. The ball will need counselling too.`,
  ] });
  if (maiden) out.push({ rank: 3, lines: [`${n(maiden.p)} bowled a maiden. In box cricket. Frame it.`] });
  if (sixes >= 10) out.push({ rank: 4, lines: [`${sixes} sixes in one match. The neighbours have filed a complaint and the balls have filed for leave.`] });
  if (extras >= 18) out.push({ rank: 5, lines: [`${extras} extras in a single match. Somewhere a coach is quietly drawing a line on the crease.`] });
  return out;
}

/** "NeuroStrikers won both of theirs, Vikings went 1–1 and Mavericks lost both." */
function tally(day: Map<string, { w: number; l: number; t: number }>): string {
  const parts = [...day.entries()]
    .sort((a, b) => b[1].w - a[1].w || a[1].l - b[1].l)
    .map(([t, r]) => {
      const n = r.w + r.l + r.t;
      const all = n === 2 ? "both of theirs" : `all ${word(n)}`;
      if (n === 1) return `${team(t)} ${r.w ? "won" : r.l ? "lost" : "tied"} their only game`;
      if (r.w === n) return `${team(t)} won ${all}`;
      if (r.l === n) return `${team(t)} lost ${all}`;
      return `${team(t)} went ${r.w}–${r.l}${r.t ? `–${r.t}` : ""}`;
    });
  return capFirst(parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] ?? "");
}

// ─── Build ───────────────────────────────────────────────────────────────────

type Piece = {
  dm: DayMatch;
  kind: "tie" | "thriller" | "rout" | "solid";
  inns: Inn[];
  mom: ReturnType<ReturnType<typeof manOfTheMatch>["get"]>;
  hero: { p: number; team: string; fig: string; size: number } | null;
  roasts: { rank: number; lines: string[] }[];
  records: string[];
};

function buildReports(): DayReport[] {
  // CricHeroes keeps names as typed; "Mahesh kumar" reads as a typo in a headline.
  const raw = buildCardData();
  const d: CardData = { ...raw, players: raw.players.map((n) => n.replace(/(^|\s)(\p{Ll})/gu, (_, sp, ch) => sp + ch.toUpperCase())) };
  const moms = manOfTheMatch(d);
  const reports: DayReport[] = [];

  // A match day is one date within a season; week = its position in the season.
  const days: { season: number; date: string; ms: number[] }[] = [];
  for (let m = 0; m < d.matches.length; m++) {
    const { season, date } = d.matches[m];
    let day = days.find((x) => x.season === season && x.date === date);
    if (!day) days.push((day = { season, date, ms: [] }));
    day.ms.push(m);
  }
  days.sort((a, b) => a.season - b.season || a.date.localeCompare(b.date));

  const recs = new Map<number, Map<string, Rec>>();
  const h2h = new Map<string, Map<string, number>>();
  const best = new Map<number, { score: number; figs: [number, number]; total: number; low: number }>();

  for (const day of days) {
    const season = day.season;
    const week = days.filter((x) => x.season === season && x.date <= day.date).length;
    const table = recs.get(season) ?? recs.set(season, new Map()).get(season)!;
    const rec = (t: string) => table.get(t) ?? table.set(t, { team: t, played: 0, won: 0, lost: 0, tied: 0, points: 0, rf: 0, bf: 0, ra: 0, ba: 0, form: [] }).get(t)!;
    for (const m of day.ms) { rec(d.matches[m].teamA); rec(d.matches[m].teamB); }
    const before = standings(table);
    const dayRec = new Map<string, { w: number; l: number; t: number }>();
    const pieces: Piece[] = [];

    for (const m of day.ms) {
      const match = d.matches[m];
      const inns = inningsOf(d, m);
      if (inns.length < 2) continue;
      const [i1, i2] = inns;
      const maxBalls = match.overs * 6;
      const r = rng(match.id);
      const firstNames = new Map<string, number>();
      for (const p of new Set(inns.flatMap((i) => [...i.bat.map((b) => b.p), ...i.bowl.map((b) => b.p)]))) {
        const f = d.players[p].split(" ")[0].toLowerCase();
        firstNames.set(f, (firstNames.get(f) ?? 0) + 1);
      }
      const c: Ctx = { d, r, seen: new Set(), firstNames };

      // Table, day tally and head-to-head.
      const winner = match.winner;
      const loser = winner ? (winner === match.teamA ? match.teamB : match.teamA) : null;
      for (const t of [match.teamA, match.teamB]) {
        const x = rec(t);
        const y = dayRec.get(t) ?? dayRec.set(t, { w: 0, l: 0, t: 0 }).get(t)!;
        x.played++;
        if (!winner) { x.tied++; x.points++; x.form.push("T"); y.t++; }
        else if (t === winner) { x.won++; x.points += 2; x.form.push("W"); y.w++; }
        else { x.lost++; x.form.push("L"); y.l++; }
      }
      for (const i of inns) {
        rec(i.team).rf += i.runs;
        rec(i.team).bf += i.balls;
        rec(i.opp).ra += i.runs;
        rec(i.opp).ba += i.balls;
      }
      const pairKey = `${season}:${[match.teamA, match.teamB].sort().join("|")}`;
      const pair = h2h.get(pairKey) ?? h2h.set(pairKey, new Map()).get(pairKey)!;
      if (winner) pair.set(winner, (pair.get(winner) ?? 0) + 1);

      // Season bests before this match, to flag records as they fall.
      const sb = best.get(season);
      const topBat = inns.flatMap((i) => i.bat).sort(byBat)[0];
      const topBowl = inns.flatMap((i) => i.bowl).sort(byBowl)[0];
      const records: string[] = [];
      const betterFigs = (f: [number, number]) => topBowl && (topBowl.wk > f[0] || (topBowl.wk === f[0] && topBowl.runs < f[1]));
      if (sb && topBat && topBat.runs > sb.score) records.push(`${poss(d.players[topBat.p])} ${topBat.runs} is the highest individual score of Season ${season} so far.`);
      if (sb && betterFigs(sb.figs)) records.push(`${poss(d.players[topBowl.p])} ${topBowl.wk}/${topBowl.runs} are the best bowling figures of the season to date.`);
      const hi = Math.max(i1.runs, i2.runs);
      const lo = Math.min(i1.runs, i2.runs);
      if (sb && hi > sb.total) records.push(`${hi} is the highest team total of the season so far.`);
      if (sb && lo < sb.low) records.push(`${lo} is the lowest total of the season so far.`);
      best.set(season, {
        score: Math.max(sb?.score ?? 0, topBat?.runs ?? 0),
        figs: !sb || betterFigs(sb.figs) ? [topBowl?.wk ?? 0, topBowl?.runs ?? 99] : sb.figs,
        total: Math.max(sb?.total ?? 0, hi),
        low: Math.min(sb?.low ?? 999, lo),
      });

      // ── Result framing
      const target = i1.runs + 1;
      const ballsLeft = maxBalls - i2.balls;
      const defended = winner === i1.team;
      const runMargin = i1.runs - i2.runs;
      const wktMargin = Number(match.winBy.match(/^(\d+) wicket/)?.[1] ?? 0);
      const kind: Piece["kind"] = !winner
        ? "tie"
        : defended
          ? runMargin <= 6 ? "thriller" : runMargin >= 30 ? "rout" : "solid"
          : ballsLeft <= 2 || wktMargin <= 2 ? "thriller" : ballsLeft >= 10 && wktMargin >= 4 ? "rout" : "solid";
      const margin = !winner
        ? "Match tied"
        : defended
          ? plural(runMargin, "run")
          : `${plural(wktMargin, "wicket")}${ballsLeft ? ` (${plural(ballsLeft, "ball")} left)` : ""}`;
      const result = winner ? `${winner} won by ${margin}` : `Match tied on ${i1.runs}`;

      // The winning side's standout, if it is headline-worthy: 30+ runs or 3+ wickets.
      const winBat = inns.flatMap((i) => i.bat).filter((b) => b.team === winner).sort(byBat)[0];
      const winBowl = inns.flatMap((i) => i.bowl).filter((b) => b.team === winner).sort(byBowl)[0];
      const hero =
        winBowl && winBowl.wk >= 3 && !(winBat && winBat.runs >= 40)
          ? { p: winBowl.p, team: winBowl.team, fig: `${winBowl.wk}/${winBowl.runs}`, size: winBowl.wk * 13 }
          : winBat && winBat.runs >= 30
            ? { p: winBat.p, team: winBat.team, fig: `${winBat.runs}${isOut(winBat.kind) ? "" : "*"}`, size: winBat.runs }
            : null;
      const W = winner ?? match.teamA;
      const L = loser ?? match.teamB;

      // ── Match headline (a subhead inside the day's article)
      let headline: string;
      if (kind === "tie") {
        headline = pick(c, [
          `Honours even: ${team(match.teamA)} and ${team(match.teamB)} tie on ${i1.runs}`,
          `Nothing to separate ${team(match.teamA)} and ${team(match.teamB)}`,
          `${i1.runs} plays ${i2.runs}: a tie, and nobody knows how to feel`,
        ]);
      } else if (hero && r() < 0.55) {
        headline = pick(c, [
          `${poss(d.players[hero.p])} ${hero.fig} carries ${team(W)} past ${team(L)}`,
          `${d.players[hero.p]} stars as ${team(W)} beat ${team(L)}`,
          `${d.players[hero.p]} the difference as ${team(W)} see off ${team(L)}`,
        ]);
      } else if (kind === "thriller") {
        headline = defended
          ? pick(c, [
            `${Team(W)} hold their nerve to edge ${team(L)} by ${plural(runMargin, "run")}`,
            `${plural(runMargin, "run")} in it: ${team(W)} survive a ${team(L)} scare`,
            `Nails bitten to the quick as ${team(W)} pinch it by ${runMargin}`,
          ])
          : pick(c, [
            `${Team(W)} sneak home against ${team(L)} with ${ballsLeft ? plural(ballsLeft, "ball") + " to spare" : "the last ball"}`,
            `Down to the wire: ${team(W)} chase ${target} to stun ${team(L)}`,
            `${Team(W)} reel in ${poss(team(L))} ${i1.runs} at the last gasp`,
          ]);
      } else if (kind === "rout") {
        headline = defended
          ? pick(c, [
            `${Team(W)} flatten ${team(L)} by ${runMargin} runs`,
            `${Team(L)} blown away as ${team(W)} win by ${runMargin}`,
            `No contest: ${team(W)} crush ${team(L)}`,
          ])
          : pick(c, [
            `${Team(W)} chase ${target} at a canter`,
            `${Team(W)} make light work of ${team(L)}`,
            `${plural(ballsLeft, "ball")} to spare: ${team(W)} cruise past ${team(L)}`,
          ]);
      } else {
        headline = defended
          ? pick(c, [
            `${Team(W)} defend ${i1.runs} to beat ${team(L)}`,
            `${poss(Team(W))} ${i1.runs} proves too many for ${team(L)}`,
            `${Team(W)} get the job done against ${team(L)}`,
          ])
          : pick(c, [
            `${Team(W)} chase down ${poss(team(L))} ${i1.runs}`,
            `${Team(W)} knock off ${target} to beat ${team(L)}`,
            `Measured chase takes ${team(W)} past ${team(L)}`,
          ]);
      }

      // ── Match write-up: an opener, the first innings, the chase.
      const opener = {
        tie: pick(c, [`Somehow, nobody won this one.`, `Bring a calculator, then put it away: it's a tie.`]),
        thriller: pick(c, [`This one went to the wire.`, `Cardiologists, look away now.`, `Tight does not begin to cover it.`]),
        rout: pick(c, [`This one was over early.`, `One-way traffic.`, `There was only ever one side in it.`]),
        solid: pick(c, [``, `A professional job from ${team(W)}.`, ``]),
      }[kind];
      const wins = winner ? pair.get(W) ?? 0 : 0;
      const losses = winner ? pair.get(L) ?? 0 : 0;
      const h2hLine = winner && wins + losses >= 3
        ? wins > losses
          ? `In this fixture it is now ${wins}–${losses} to ${team(W)} this season.`
          : wins === losses
            ? `The season series between the two is level at ${wins}–${losses}.`
            : `${Team(L)} still lead this season's head-to-head ${losses}–${wins}.`
        : "";
      const paragraphs = [
        [opener, ...firstInnings(c, i1, maxBalls)].filter(Boolean).join(" "),
        [...secondInnings(c, i2, target, maxBalls, winner ? winner === i2.team : null), h2hLine].filter(Boolean).join(" "),
      ];

      const mom = moms.get(m);
      const toReport = (inn: Inn): ReportInnings => ({
        team: inn.team, runs: inn.runs, wickets: inn.wickets, balls: inn.balls, extras: inn.extras,
        batting: inn.bat.map((b) => ({ name: d.players[b.p], how: howOut(d, b), out: isOut(b.kind), runs: b.runs, balls: b.balls, f4: b.f4, s6: b.s6 })),
        bowling: inn.bowl.map((b) => ({ name: d.players[b.p], balls: b.balls, mdn: b.mdn, runs: b.runs, wk: b.wk, dots: b.dots })),
        fow: inn.bat.filter((b) => b.fow).map((b) => ({ wicket: b.fow![0], score: b.fow![1], over: b.fow![2], name: d.players[b.p] })).sort((a, b) => a.wicket - b.wicket),
      });

      pieces.push({
        dm: {
          matchNo: pieces.length + 1,
          kicker: { tie: "Tie", thriller: "Thriller", rout: "Statement win", solid: "Result" }[kind],
          headline: capFirst(headline),
          winner,
          result,
          overs: match.overs,
          innings: [toReport(i1), toReport(i2)],
          paragraphs,
          potm: mom ? { name: d.players[mom.p], team: mom.team, line: proseLine(mom.line) } : null,
        },
        kind,
        inns,
        mom,
        hero,
        roasts: roasts(d, inns),
        records,
      });
    }
    if (!pieces.length) continue;

    // ── The day
    const after = standings(table).map((row, idx) => ({ ...row, moved: before.findIndex((x) => x.team === row.team) - idx }));
    const c: Ctx = { d, r: rng(`${season}-${day.date}`), seen: new Set(), firstNames: new Map() };
    const venue = venueName(d.matches[day.ms[0]].venue);
    const n = pieces.length;
    const entries = [...dayRec.entries()];
    const perfect = entries.filter(([, x]) => x.w >= 2 && x.l === 0 && x.t === 0).map(([t]) => t);
    const winless = entries.filter(([, x]) => x.l >= 2 && x.w === 0 && x.t === 0).map(([t]) => t);
    const leaderBefore = before[0]?.played ? before[0].team : null;
    const leader = after[0];
    const newLeader = leaderBefore && leaderBefore !== leader.team ? leader.team : null;
    const nervy = pieces.filter((p) => p.kind === "thriller" || p.kind === "tie").length;
    // Star of the day: the Player of the Match with the biggest raw haul (runs
    // + 13 a wicket). The award model's scores are relative to each match's
    // conditions, so they don't compare across games.
    const haul = (p: Piece) => {
      const who = p.mom!.p;
      const inn = p.inns.flatMap((i) => [...i.bat.filter((b) => b.p === who).map((b) => b.runs), ...i.bowl.filter((b) => b.p === who).map((b) => b.wk * 13)]);
      return inn.reduce((a, b) => a + b, 0);
    };
    const starPiece = [...pieces].filter((p) => p.mom).sort((a, b) => haul(b) - haul(a) || b.mom!.score - a.mom!.score)[0];
    // A big enough star leads the headline: "41* (19) & 0/14 (2)" → "41*".
    let starHero: NonNullable<Piece["hero"]> | null = null;
    if (starPiece && haul(starPiece) >= 30) {
      const sm = starPiece.mom!;
      const bits = sm.line.split(" & ");
      const bat = bits.find((b) => /^\d+\*? \(/.test(b))?.replace(/ \(.*/, "");
      const bowl = bits.find((b) => /^\d+\/\d+/.test(b))?.replace(/ \(.*/, "");
      const wk = Number(bowl?.split("/")[0] ?? 0);
      const fig = bowl && (!bat || wk * 13 > parseInt(bat)) ? bowl : bat ?? bowl ?? "";
      starHero = { p: sm.p, team: sm.team, fig, size: haul(starPiece) };
    }
    const bigHero = starHero && starHero.size >= 50 ? starHero : null;

    // Storylines of the day, scored; the headline leads with the strongest and
    // folds in a second one ("Vikings go top as Bhairav Deep hits 46*").
    type Story = { score: number; kicker: string; subject: string; main: string; clause?: string };
    const stories: Story[] = [];
    const heroClause = (h: NonNullable<Piece["hero"]>) =>
      h.fig.includes("/") ? `${d.players[h.p]} takes ${h.fig}` : `${d.players[h.p]} hits ${h.fig}`;
    if (newLeader) stories.push({
      score: 5, kicker: "New leaders", subject: newLeader,
      main: pick(c, [`${Team(newLeader)} go top after Week ${week}`, `New leaders: ${team(newLeader)} take over at the summit`]),
      clause: `${team(newLeader)} go top`,
    });
    const record = pieces.flatMap((p) => p.records).find((x) => /individual score|bowling figures/.test(x));
    if (bigHero) stories.push({
      score: record ? 5 : 4, kicker: record ? "Record night" : "Star turn", subject: bigHero.team,
      main: pick(c, [`${poss(d.players[bigHero.p])} ${bigHero.fig} lights up Week ${week}`, `${d.players[bigHero.p]} steals the show in Week ${week}`]),
      clause: heroClause(bigHero),
    });
    else if (starHero) stories.push({
      score: 2, kicker: "Star turn", subject: starHero.team,
      main: pick(c, [`${poss(d.players[starHero.p])} ${starHero.fig} the pick of Week ${week}`, `${d.players[starHero.p]} leads the way in Week ${week}`]),
      clause: heroClause(starHero),
    });
    if (nervy >= 2) stories.push({
      score: 2 + nervy, kicker: "Thriller night", subject: "",
      main: pick(c, [`${capFirst(word(nervy))} thrillers in ${word(n)} games: Week ${week} had everything`, `Week ${week}: nerves shredded, ${word(nervy)} times over`]),
    });
    for (const t of perfect) {
      const k = dayRec.get(t)!.w;
      stories.push({
        score: k >= 3 ? 4 : 2.5, kicker: "Clean sweep", subject: t,
        main: pick(c, [
          `Perfect day for ${team(t)}: ${word(k)} from ${word(k)} at ${venue}`,
          winless.length ? `${Team(t)} sweep the day as ${team(winless[0])} draw a blank` : `${Team(t)} sweep Week ${week}`,
        ]),
        clause: `${team(t)} go ${word(k)} from ${word(k)}`,
      });
    }
    for (const t of winless) {
      const k = dayRec.get(t)!.l;
      stories.push({ score: 1, kicker: "Matchday", subject: t, main: `Long evening for ${team(t)}: ${word(k)} games, ${word(k)} defeats`, clause: `${team(t)} lose ${word(k)}` });
    }
    stories.push({
      score: 0, kicker: "Matchday", subject: "",
      main: pick(c, [`Week ${week}: honours shared at ${venue}`, `Points spread around as Week ${week} keeps the table tight`]),
    });
    stories.sort((a, b) => b.score - a.score || c.r() - 0.5);
    const lead = stories[0];
    const second = stories.slice(1).find((x) => x.clause && x.score >= 2 && x.subject !== lead.subject);
    let kicker = lead.kicker;
    let headline = lead.clause && second && c.r() < 0.6 ? `${lead.clause} as ${second.clause}` : lead.main;
    if (week === 1) kicker = "Season opener";
    headline = capFirst(headline);

    const dek = `${capFirst(word(n))} ${n === 1 ? "match" : "matches"} at ${venue}: ${tally(dayRec)}.`;

    // Lede: the shape of the day, then what it did to the table.
    const lede: string[] = [];
    lede.push(week === 1
      ? pick(c, [
        `Season ${season} got under way at ${venue} on ${weekday(day.date)}, ${word(n)} matches deep.`,
        `And we're off. Season ${season} opened at ${venue} on ${weekday(day.date)} with ${word(n)} matches.`,
      ])
      : pick(c, [
        `Week ${week} of Season ${season} brought ${word(n)} ${n === 1 ? "match" : "matches"} to ${venue} on ${weekday(day.date)}.`,
        `${capFirst(word(n))} ${n === 1 ? "match" : "matches"}, one evening, one box at ${venue}: this was Week ${week}.`,
        `${weekday(day.date)} at ${venue} served up ${word(n)} ${n === 1 ? "match" : "matches"} for Week ${week}.`,
      ]));
    if (nervy >= 2 && kicker !== "Thriller night") lede.push(`${capFirst(word(nervy))} of them went down to the wire.`);
    else if (nervy === 1) {
      const p = pieces.find((x) => x.kind === "thriller" || x.kind === "tie")!;
      lede.push(p.kind === "tie" ? `One of them couldn't be separated at all.` : `The tightest of them, ${p.dm.result.replace(/ won by /, " by ").replace(/ \(.*\)/, "")}, came down to the last few balls.`);
    }
    if (starPiece?.mom) {
      const sm = starPiece.mom;
      lede.push(pick(c, [
        `The standout performance belonged to ${d.players[sm.p]}: ${proseLine(sm.line)}.`,
        `If one player owned the evening, it was ${d.players[sm.p]}, with ${proseLine(sm.line)}.`,
      ]));
    }
    if (newLeader) lede.push(`${Team(newLeader)} end the day top of the table on ${plural(leader.points, "point")}.`);
    else if (!leaderBefore) lede.push(`${Team(leader.team)} lead the early table.`);
    else {
      const gap = leader.points - (after[1]?.points ?? 0);
      lede.push(gap > 0
        ? `${Team(leader.team)} stay top, ${plural(gap, "point")} clear.`
        : `${Team(leader.team)} stay top, but only on percentage and net run rate.`);
    }
    for (const t of dayRec.keys()) {
      const x = rec(t);
      const s = streak(x.form);
      const today = dayRec.get(t)!;
      const firstWin = today.w > 0 && x.won === today.w && x.played > today.w + today.l + today.t;
      if (firstWin) lede.push(`${Team(t)} finally have a win on the board this season.`);
      else if (s.kind === "W" && s.n >= 3) lede.push(`${Team(t)} have now won ${word(s.n)} on the bounce.`);
      else if (s.kind === "L" && s.n >= 3) lede.push(`${Team(t)} have lost ${word(s.n)} in a row.`);
    }

    let star: DayReport["star"] = null;
    if (starPiece?.mom) {
      const sm = starPiece.mom;
      const name = d.players[sm.p];
      const awards = pieces.filter((p) => p.mom?.p === sm.p).length;
      star = {
        name,
        team: sm.team,
        line: proseLine(sm.line),
        blurb: [
          pick(c, [
            `${name} gets our vote for ${proseLine(sm.line)}.`,
            `${proseLine(sm.line)} — nobody had a bigger say on the day than ${name}.`,
          ]),
          awards > 1
            ? `Player of the Match twice in one evening, which is just showing off.`
            : sm.winner
              ? `Measured against the conditions of the game, no one did more in Week ${week}.`
              : `It came in a losing cause, which takes some doing.`,
        ].join(" "),
      };
    }

    // Numbers of the day.
    const allBat = pieces.flatMap((p) => p.inns.flatMap((i) => i.bat));
    const allBowl = pieces.flatMap((p) => p.inns.flatMap((i) => i.bowl));
    const runs = pieces.reduce((s, p) => s + p.inns.reduce((t, i) => t + i.runs, 0), 0);
    const balls = pieces.reduce((s, p) => s + p.inns.reduce((t, i) => t + i.balls, 0), 0);
    const sixes = allBat.reduce((s, b) => s + b.s6, 0);
    const extras = pieces.reduce((s, p) => s + p.inns.reduce((t, i) => t + i.extras, 0), 0);
    const dots = allBowl.reduce((s, b) => s + b.dots, 0);
    const topBat = [...allBat].sort(byBat)[0];
    const topBowl = [...allBowl].sort(byBowl)[0];
    const numbers: DayReport["numbers"] = [
      { value: String(runs), label: `runs across the day, ${((runs / balls) * 6).toFixed(1)} an over` },
      { value: String(sixes), label: sixes === 1 ? "six all day" : "sixes" },
    ];
    if (topBat) numbers.push({ value: `${topBat.runs}${isOut(topBat.kind) ? "" : "*"}`, label: `top score, ${d.players[topBat.p]} (${topBat.balls} balls)` });
    if (topBowl?.wk) numbers.push({ value: `${topBowl.wk}/${topBowl.runs}`, label: `best bowling, ${d.players[topBowl.p]}` });
    numbers.push({ value: `${Math.round((100 * dots) / balls)}%`, label: `dot balls (${dots} of ${balls})` });
    numbers.push({ value: String(extras), label: "extras conceded" });

    // The day's roast: the best material from any match.
    const material = pieces.flatMap((p) => p.roasts);
    const topRank = Math.min(...material.map((x) => x.rank));
    const verdict = material.length
      ? pick(c, material.filter((x) => x.rank === topRank).flatMap((x) => x.lines))
      : pick(c, [
        `No ducks, no disasters, no roast. Professionalism all evening; we'll expect worse next week.`,
        `We had our pens ready for a roast and the players gave us nothing. Rude.`,
      ]);

    reports.push({
      slug: `season-${season}-week-${week}`,
      season,
      week,
      date: day.date,
      venue,
      kicker,
      headline,
      dek,
      byline: pick(c, BYLINES),
      lede,
      matches: pieces.map((p) => p.dm),
      records: pieces.flatMap((p) => p.records),
      star,
      numbers,
      verdict,
      table: after,
      prev: null,
      next: null,
    });
  }

  // Prev/next within a season.
  for (let i = 0; i < reports.length; i++) {
    const a = reports[i - 1];
    const b = reports[i + 1];
    if (a && a.season === reports[i].season) reports[i].prev = { slug: a.slug, headline: a.headline };
    if (b && b.season === reports[i].season) reports[i].next = { slug: b.slug, headline: b.headline };
  }
  return reports;
}

// ─── Public API ──────────────────────────────────────────────────────────────

let cache: DayReport[] | null = null;
const all = () => (cache ??= buildReports());

export function dayReports(): DayReport[] {
  return all();
}

export function dayReportBySlug(slug: string): DayReport | null {
  return all().find((r) => r.slug === slug) ?? null;
}

/** Newest first, trimmed to what the listing page renders. */
export function dayReportPreviews(): DayPreview[] {
  return [...all()].reverse().map((r) => ({
    slug: r.slug, season: r.season, week: r.week, date: r.date, venue: r.venue,
    kicker: r.kicker, headline: r.headline, dek: r.dek,
    matches: r.matches.map((m) => ({
      kicker: m.kicker,
      winner: m.winner,
      scores: m.innings.map((i) => ({ team: i.team, runs: i.runs, wickets: i.wickets, balls: i.balls })),
    })),
    star: r.star?.name ?? null,
  }));
}
