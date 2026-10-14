// Every story card a player's profile earns, in the order the share gallery
// shows them. The rules:
//
//  1. Good news only. No "warn" badges, no weaknesses, no coaching, no
//     nemesis or duck cards, no rank outside the top 10 / top 25%. Nobody
//     shares a card that roasts them.
//  2. Only what the scorecards can prove. They record who dismissed whom but
//     not runs scored off a particular bowler, so head-to-head cards talk in
//     meetings and wickets, never "runs off X".
//  3. One card per moment. A Player of the Match card owns that match: its
//     innings and spell don't get cards of their own. A badge that restates a
//     rank rides on the rank card as a chip.
//  4. Capped per kind, so a star player gets ~20 cards, not 60.

import { f0, f1, f2, fmtDate, ov, plural, type Profile } from "@/lib/scorecard-dashboard/profile";
import { gradientStops, type CardPerson, type ShareCardSpec } from "@/lib/share-card";
import { teamByName } from "@/lib/teams";
import { burstFor, emblemImage, tierOf } from "./achievements";

export type ShareCard = { id: string; label: string; spec: ShareCardSpec; text: string };

/** The subset of a key battle the cards need (see keyBattles in profile.ts). */
type BattleLike = { batter: number; bowler: number; batTeam: string; bowlTeam: string; batterWins: number; bowlerWins: number; meetings: unknown[] };

const GOLD: [string, string] = ["#F3C96A", "#A97824"];
const ORANGE = gradientStops("linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)");
const PURPLE = gradientStops("linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)");
const GREEN = gradientStops("linear-gradient(135deg, #6EE7B7 0%, #2E8B57 100%)");

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >> 3) ^ 1 && n % 10] || "th"}`;
const first = (name: string) => name.split(/\s+/)[0];
const battingFacts = (r: { runs: number; balls: number; f4: number; s6: number }) => [
  { label: "Fours", value: String(r.f4) },
  { label: "Sixes", value: String(r.s6) },
  { label: "Strike rate", value: r.balls ? f0((100 * r.runs) / r.balls) : "–" },
];
/** "27* (21) & 4/24 (2)" → two headline figures: the innings and the spell. */
/** "27* (21) & 4/24 (2)" → the card's headline figures. Shared with the profile story. */
export const potmFigures = (line: string): Pick<ShareCardSpec, "figures" | "hero"> => {
  const parts = line.split(/\s*&\s*/).map((part) => {
    const m = part.match(/^(\S+)\s*\((\d+(?:\.\d)?)\)$/);
    if (!m) return { value: part, unit: "" };
    return m[1].includes("/") ? { value: m[1], unit: `in ${m[2]} overs` } : { value: m[1], unit: `off ${m[2]} balls` };
  });
  return parts.length > 1 ? { figures: parts } : { hero: { value: parts[0].value, unit: parts[0].unit, colors: GOLD } };
};

type RankKey = keyof Profile["ranks"];
/** How each league rank reads on a card, and the number behind it. */
const RANKS: Record<RankKey, { tab: string; title: string; colors: [string, string]; stat: (pr: Profile) => string }> = {
  runs: { tab: "runs", title: "highest run-scorer", colors: ORANGE, stat: (pr) => plural(pr.B.runs, "run") },
  six: { tab: "sixes", title: "most sixes", colors: ORANGE, stat: (pr) => plural(pr.B.s6, "six", "sixes") },
  sr: { tab: "strike rate", title: "fastest scorer", colors: ORANGE, stat: (pr) => `Strike rate ${f1(pr.B.sr)}` },
  wk: { tab: "wickets", title: "highest wicket-taker", colors: PURPLE, stat: (pr) => plural(pr.W.wk, "wicket") },
  econ: { tab: "economy", title: "most economical bowler", colors: PURPLE, stat: (pr) => `${f2(pr.W.econ)} an over` },
  dot: { tab: "dot balls", title: "most dot balls bowled", colors: PURPLE, stat: (pr) => plural(pr.W.dots, "dot ball") },
  death: { tab: "death overs", title: "most death-over wickets", colors: PURPLE, stat: (pr) => plural(pr.phase.death, "wicket") },
  pp: { tab: "powerplay", title: "most powerplay wickets", colors: PURPLE, stat: (pr) => plural(pr.phase.powerplay, "wicket") },
  field: { tab: "fielding", title: "most fielding dismissals", colors: GREEN, stat: (pr) => plural(pr.F.total, "dismissal") },
};
/** Badges that say the same thing as a rank card; they become its chips. */
const BADGE_RANK: Record<string, RankKey> = {
  "Orange Cap": "runs", "Big Scorer": "runs",
  "Six Machine": "six", "Power Hitter": "six", "Boundary King": "six",
  "Fastest Scorer": "sr", "Strike-Rate Beast": "sr",
  "Purple Cap": "wk", "Strike Bowler": "wk",
  "Most Economical": "econ", "Run-Stopper": "econ",
  "Dot-Ball Monster": "dot", "Pressure Builder": "dot",
  "Death-Over King": "death", "Death-Over Specialist": "death",
  "Powerplay Striker": "pp", "New-Ball Threat": "pp",
  "Gold Glove": "field", "Safe Hands": "field",
};
const qualifies = (r: { rank: number; of: number } | null): r is { rank: number; of: number } => !!r && (r.rank <= 10 || r.rank / r.of <= 0.25);

export function profileShareCards({
  pr, scopeLabel, battles, holders, photoOf, origin, host,
}: {
  pr: Profile;
  scopeLabel: string;
  battles: BattleLike[];
  /** How many players hold each badge, for "1 of 3 in the league". */
  holders: Map<string, number>;
  photoOf: (name: string) => string | null;
  /** window.location.origin / host, passed in so this stays pure. */
  origin: string;
  host: string;
}): ShareCard[] {
  const team = teamByName(pr.team);
  const me: CardPerson = { name: pr.name, photo: photoOf(pr.name), color: team?.primary };
  const base = { person: me, accent: team?.primary, teamLogo: team?.logo, team: pr.team, footer: `${host}/stats` } satisfies Partial<ShareCardSpec>;
  const link = `${origin}/stats`;
  const cards: ShareCard[] = [];
  const add = (id: string, label: string, spec: Omit<ShareCardSpec, "footer">, line: string) =>
    cards.push({ id, label, spec: { ...base, ...spec }, text: `${line}\n— ${pr.name}, JCC Stats · ${scopeLabel}\n${link}` });
  const positive = pr.badges.filter((b) => b.tone !== "warn");
  const rankNote = (r: { rank: number; of: number } | null) => (r ? `#${r.rank} of ${r.of}` : undefined);
  const momKey = new Set(pr.mom.map((m) => `${m.date}|${m.opp}`));

  // A · Overview
  add("overview", "Overview", {
    kicker: `${scopeLabel} · ${pr.role}`,
    title: pr.name,
    subtitle: `${pr.teams.join(" · ")} · ${plural(pr.matches, "match", "matches")}`,
    stats: [
      { label: "Runs", value: f0(pr.B.runs), note: rankNote(pr.ranks.runs) },
      { label: "Wickets", value: f0(pr.W.wk), note: rankNote(pr.ranks.wk) },
      { label: "Fielding", value: f0(pr.F.total), note: rankNote(pr.ranks.field) },
      pr.B.inns ? { label: "Strike rate", value: f1(pr.B.sr) } : { label: "Innings", value: "0" },
      pr.W.spells ? { label: "Economy", value: f2(pr.W.econ) } : { label: "Overs", value: "0" },
      pr.B.inns ? { label: "Best", value: String(pr.B.hs) } : { label: "Best", value: pr.W.best || "—" },
    ],
    chips: positive.slice(0, 6).map((b) => b.label),
  }, `${pr.B.runs} runs, ${pr.W.wk} wickets, ${pr.F.total} fielding dismissals in ${plural(pr.matches, "match", "matches")}`);

  // A2 · The trophy cabinet: every badge on one card, rarest first
  if (positive.length >= 2) {
    const cabinet = [...positive].sort((a, b) => Number(b.tone === "crown") - Number(a.tone === "crown") || (holders.get(a.label) ?? 1) - (holders.get(b.label) ?? 1));
    add("badges", "All badges", {
      kicker: `Trophy cabinet · ${scopeLabel}`,
      title: `${plural(positive.length, "badge")} unlocked`,
      list: cabinet.slice(0, 9).map((b) => {
        const n = holders.get(b.label) ?? 1;
        return { name: b.label, value: n === 1 ? "Only one" : `1 of ${n}`, note: b.why, photo: emblemImage(b.label, b.tone, tierOf(b.tone, n)), logo: true };
      }),
      byline: pr.name,
    }, `${positive.length} badges: ${cabinet.map((b) => b.label).join(", ")}`);
  }

  // C · Player of the Match, most recent first
  [...pr.mom].reverse().slice(0, 4).forEach((m, i) => {
    add(`mom-${m.date}-${i}`, "Player of the Match", {
      kicker: `Player of the Match · ${fmtDate(m.date)}`,
      title: `Player of the Match against ${m.opp}`,
      ...potmFigures(m.line),
      facts: [{ label: "Against", value: m.opp }, { label: "Date", value: fmtDate(m.date) }, pr.mom.length > 1 ? { label: "Awards", value: String(pr.mom.length) } : { label: "Season", value: String(m.season) }],
    }, `Player of the Match vs ${m.opp}: ${m.line}`);
  });

  // B · League ranks, best first; matching badges ride along as chips
  const used = new Set<string>();
  (Object.keys(RANKS) as RankKey[])
    .map((k) => ({ k, r: pr.ranks[k] }))
    .filter((x): x is { k: RankKey; r: { rank: number; of: number } } => qualifies(x.r))
    .sort((a, b) => a.r.rank / a.r.of - b.r.rank / b.r.of)
    .slice(0, 5)
    .forEach(({ k, r }) => {
      const R = RANKS[k];
      const chips = positive.filter((b) => BADGE_RANK[b.label] === k).map((b) => b.label);
      chips.forEach((c) => used.add(c));
      add(`rank-${k}`, `#${r.rank} ${R.tab}`, {
        kicker: `League rank · ${scopeLabel}`,
        title: r.rank === 1 ? `Number one for ${R.tab} in the league` : `${ordinal(r.rank)} ${R.title} in the league`,
        hero: { value: `#${r.rank}`, unit: `of ${r.of} players`, colors: R.colors },
        chips,
        facts: [{ label: "Total", value: R.stat(pr) }, { label: "Percentile", value: `Top ${Math.max(1, Math.round((100 * r.rank) / r.of))}%` }, { label: "Scope", value: scopeLabel }],
      }, `#${r.rank} of ${r.of} for ${R.tab}: ${R.stat(pr)}`);
    });

  // D · Best innings, E · Blitzes (never the Player of the Match innings)
  const inns = pr.batting.log.filter((r) => !momKey.has(`${r.date}|${r.opp}`));
  const score = (r: (typeof inns)[number]) => `${r.runs}${r.out ? "" : "*"}`;
  const best = [...inns].sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0];
  if (best && best.runs >= 20) {
    add("best-innings", "Best innings", {
      kicker: `Best innings · ${fmtDate(best.date)}`,
      title: `${best.chasing ? "Chasing" : "Batting first"} against ${best.opp}`,
      hero: { value: score(best), unit: `off ${plural(best.balls, "ball")}`, colors: ORANGE },
      body: best.won ? "And the team won." : undefined,
      facts: battingFacts(best),
    }, `${score(best)} (${best.balls}) vs ${best.opp}`);
  }
  inns
    .filter((r) => r !== best && r.runs >= 15 && r.balls && (100 * r.runs) / r.balls >= 200)
    .sort((a, b) => b.runs / b.balls - a.runs / a.balls)
    .slice(0, 2)
    .forEach((r, i) => {
      add(`blitz-${i}`, "Blitz", {
        kicker: `Blitz · ${fmtDate(r.date)}`,
        title: `Strike rate ${f0((100 * r.runs) / r.balls)} against ${r.opp}`,
        hero: { value: score(r), unit: `off ${plural(r.balls, "ball")}`, colors: ORANGE },
        body: r.won ? "And the team won." : undefined,
        facts: battingFacts(r),
      }, `${score(r)} off ${r.balls} vs ${r.opp}`);
    });

  // F · Best spell (2+ wickets) and every other 3+ wicket haul
  const spells = pr.bowling.spells.filter((s) => !momKey.has(`${s.date}|${s.opp}`)).sort((a, b) => b.wk - a.wk || a.runs - b.runs);
  spells
    .filter((s, i) => (i === 0 && s.wk >= 2) || s.wk >= 3)
    .slice(0, 3)
    .forEach((s, i) => {
      add(`spell-${i}`, i === 0 ? "Best spell" : "Haul", {
        kicker: `${i === 0 ? "Best bowling" : `${s.wk}-wicket haul`} · ${fmtDate(s.date)}`,
        title: `${plural(s.wk, "wicket")} against ${s.opp}`,
        hero: { value: `${s.wk}/${s.runs}`, unit: `in ${ov(s.balls)} overs`, colors: PURPLE },
        body: s.won ? "And the team won." : undefined,
        facts: [{ label: "Dot balls", value: String(s.dots) }, { label: "Economy", value: f2((6 * s.runs) / Math.max(1, s.balls)) }, s.mdn ? { label: "Maidens", value: String(s.mdn) } : { label: "Season", value: String(s.season) }],
      }, `${s.wk}/${s.runs} (${ov(s.balls)}) vs ${s.opp}`);
    });

  // G · Achievements not already on a rank card
  positive.filter((b) => !used.has(b.label)).slice(0, 6).forEach((b) => {
    // Rarity is only worth a headline number when few players have the badge.
    // The emblem leads; the player sits under it as the holder.
    const n = holders.get(b.label) ?? 1;
    const tier = tierOf(b.tone, n);
    add(`badge-${b.label}`, b.label, {
      kicker: `${b.label} · ${tier.charAt(0).toUpperCase()}${tier.slice(1)} badge`,
      title: pr.name,
      body: b.why,
      emblem: emblemImage(b.label, b.tone, tier),
      burst: burstFor(b.tone, b.label),
      accent: burstFor(b.tone, b.label)[1],
      facts: [
        { label: "Badge", value: b.label },
        { label: "Tier", value: `${tier.charAt(0).toUpperCase()}${tier.slice(1)}` },
        { label: "Holders", value: n === 1 ? "Only one" : `1 of ${n}` },
      ],
    }, `${b.label}: ${b.why}`);
  });

  // H · Strengths (the good and the neutral notes, never the bad)
  [...pr.insights.good, ...pr.insights.info].slice(0, 3).forEach((n, i) => {
    add(`strength-${i}`, n.title, { kicker: "Strength", title: n.title, body: n.body }, `${n.title}: ${n.body}`);
  });

  // I · Rivalries (the league's key battles this player is in)
  const opp = (p: number, teamName: string): CardPerson => ({ name: pr.nameOf(p), photo: photoOf(pr.nameOf(p)), color: teamByName(teamName)?.primary });
  const rivals = new Set<number>();
  battles.filter((x) => x.batter === pr.p || x.bowler === pr.p).slice(0, 3).forEach((x) => {
    const batting = x.batter === pr.p;
    const them = batting ? x.bowler : x.batter;
    rivals.add(them);
    const mine = batting ? x.batterWins : x.bowlerWins, theirs = batting ? x.bowlerWins : x.batterWins;
    add(`rivalry-${them}`, `vs ${first(pr.nameOf(them))}`, {
      kicker: `Rivalry · ${batting ? "I bat, they bowl" : "I bowl, they bat"}`,
      title: mine > theirs ? `Edging it against ${pr.nameOf(them)}` : mine === theirs ? `Dead level with ${pr.nameOf(them)}` : `The rivalry with ${pr.nameOf(them)}`,
      hero: { value: `${mine}–${theirs}`, unit: plural(x.meetings.length, "meeting"), colors: GOLD },
      facts: [{ label: "Meetings", value: String(x.meetings.length) }, { label: batting ? "Survived" : "Wickets", value: String(mine) }, { label: batting ? "Out to them" : "They survived", value: String(theirs) }],
      body: batting
        ? `Survived ${first(pr.nameOf(them))} ${plural(mine, "time")}, out to them ${plural(theirs, "time")}.`
        : `Got ${first(pr.nameOf(them))} out ${plural(mine, "time")}, they survived ${plural(theirs, "time")}.`,
      versus: { left: me, right: opp(them, batting ? x.bowlTeam : x.batTeam) },
    }, `Me vs ${pr.nameOf(them)}: ${mine}–${theirs} in ${x.meetings.length} meetings`);
  });

  // J · Bunnies: batters this player has dismissed twice or more
  pr.bowling.matchups
    .filter((m) => m.wk >= 2 && !rivals.has(m.p))
    .sort((a, b) => b.wk - a.wk || a.inns - b.inns)
    .slice(0, 3)
    .forEach((m) => {
      add(`bunny-${m.p}`, `Got ${first(pr.nameOf(m.p))}`, {
        kicker: "Head to head · with the ball",
        title: `Dismissed ${pr.nameOf(m.p)} ${m.wk === 2 ? "twice" : `${m.wk} times`}`,
        hero: { value: String(m.wk), unit: `wickets in ${plural(m.inns, "meeting")}`, colors: PURPLE },
        facts: [{ label: "Meetings", value: String(m.inns) }, { label: "Wickets", value: String(m.wk) }, m.ducks ? { label: "For ducks", value: String(m.ducks) } : { label: "Hit rate", value: `${Math.round((100 * m.wk) / m.inns)}%` }],
        versus: { left: me, right: { name: pr.nameOf(m.p), photo: photoOf(pr.nameOf(m.p)) } },
      }, `Dismissed ${pr.nameOf(m.p)} ${m.wk} times in ${m.inns} meetings`);
    });

  // K · Bowlers who've bowled at this player in 4+ matches and never got them
  pr.batting.matchups
    .filter((m) => m.inns >= 4 && m.wk === 0 && !rivals.has(m.p))
    .sort((a, b) => b.inns - a.inns)
    .slice(0, 3)
    .forEach((m) => {
      add(`unbeaten-${m.p}`, `vs ${first(pr.nameOf(m.p))}`, {
        kicker: "Head to head · with the bat",
        title: `${pr.nameOf(m.p)} has never got me out`,
        hero: { value: "0", unit: `dismissals in ${plural(m.inns, "meeting")}`, colors: GREEN },
        facts: [{ label: "Meetings", value: String(m.inns) }, { label: "Times out", value: "0" }, { label: "Survived", value: "Every time" }],
        versus: { left: me, right: { name: pr.nameOf(m.p), photo: photoOf(pr.nameOf(m.p)) } },
      }, `${pr.nameOf(m.p)} has bowled at me in ${m.inns} matches and never got me out`);
    });

  // L · Ever-present
  const a = pr.attendance;
  if (a.ofMatchdays >= 4 && a.matchdays === a.ofMatchdays) {
    add("ever-present", "Ever-present", {
      kicker: "Turned up every time",
      title: "Never missed a matchday",
      hero: { value: `${a.matchdays}/${a.ofMatchdays}`, unit: "matchdays", colors: GREEN },
      facts: [{ label: "Matches", value: String(a.present) }, { label: "Attendance", value: `${a.pct}%` }, { label: "Team", value: a.team }],
    }, `Never missed a matchday: ${a.matchdays}/${a.ofMatchdays}`);
  } else if (a.teamMatches >= 8 && a.pct >= 90) {
    add("ever-present", "Ever-present", {
      kicker: "Turned up every time",
      title: `Played ${a.pct}% of ${a.team}'s matches`,
      hero: { value: `${a.present}/${a.teamMatches}`, unit: "matches", colors: GREEN },
    }, `Played ${a.present} of ${a.team}'s ${a.teamMatches} matches`);
  }

  // M · Safe hands (unless the fielding rank card already said it)
  if (pr.F.total >= 8 && !cards.some((c) => c.id === "rank-field")) {
    const f = pr.F;
    add("fielding", "Fielding", {
      kicker: "In the field",
      title: "Safe hands",
      hero: { value: String(f.total), unit: "fielding dismissals", colors: GREEN },
      facts: [{ label: "Catches", value: String(f.total - f.ro - f.st) }, { label: "Run outs", value: String(f.ro) }, { label: "Stumpings", value: String(f.st) }],
    }, `${f.total} fielding dismissals`);
  }

  return cards;
}
