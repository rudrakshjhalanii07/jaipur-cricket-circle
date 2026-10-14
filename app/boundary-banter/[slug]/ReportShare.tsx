"use client";

// Story cards for a Boundary Banter matchday report: the week in one card,
// then one per match, the star of the day, the day in numbers and the table.
// A match's own Share button puts that match first in the gallery.

import { ListOrdered } from "lucide-react";
import { SectionShare, GOLD, listCard, teamRow } from "@/app/stats/SectionShare";
import type { SheetCard } from "@/app/stats/ShareSheet";
import type { DayMatch, DayPreview, DayReport } from "@/lib/match-reports";
import type { ResultRow, ResultSide, ShareCardSpec } from "@/lib/share-card";
import { ov } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";

/** "26* off 17 balls and 1/8 from 2 overs" → headline figures. */
function figuresOf(line: string): { value: string; unit: string }[] {
  return line
    .split(/\s+and\s+/)
    .map((part) => {
      const bat = part.match(/^(\S+) off (\d+) balls?$/);
      if (bat) return { value: bat[1], unit: `off ${bat[2]} balls` };
      const bowl = part.match(/^(\d+\/\d+) from ([\d.]+) overs?$/);
      if (bowl) return { value: bowl[1], unit: `in ${bowl[2]} ${bowl[2] === "1" ? "over" : "overs"}` };
      return null;
    })
    .filter((f): f is { value: string; unit: string } => !!f);
}

/** "runs across the day, 8.5 an over" → "Runs"; "top score, Sagar" → "Top score". */
const shortLabel = (label: string) => {
  const words = label.split(",")[0].replace(/\s*\(.*\)/, "").split(/\s+/);
  let out = words[0];
  for (const w of words.slice(1)) if ((out + " " + w).length <= 12) out += " " + w; else break;
  return out.charAt(0).toUpperCase() + out.slice(1);
};

const margin = (result: string) => result.replace(/^.* won by /, "").replace(/\s*\(.*\)$/, "");

type Side = { team: string; runs: number; wickets: number; balls: number };

/** A match as a scoreboard tile: both sides, the winner lit, the margin on the right. */
function resultRow([a, b]: Side[], winner: string | null, by?: string | null): ResultRow {
  const side = (x: Side): ResultSide => ({ team: x.team, score: `${x.runs}/${x.wickets}`, logo: teamByName(x.team)?.logo ?? null, color: teamByName(x.team)?.primary });
  if (!winner) return { a: side(a), b: side(b), winner: null, verdict: ["Tied on", String(a.runs)] };
  const short = by ? by.replace(/ wickets?\b/, (x) => (x.trim() === "wicket" ? " wkt" : " wkts")) : null;
  return { a: side(a), b: side(b), winner: a.team === winner ? "a" : "b", verdict: short ? ["Won by", short] : ["Winner", winner] };
}

export function reportCards(report: DayReport, photos: Record<string, string | null>, first?: number): SheetCard[] {
  const host = window.location.host;
  const url = `${window.location.origin}/boundary-banter/${report.slug}`;
  const week = `Season ${report.season} · Week ${report.week}`;
  const base = (accent?: string, teamLogo?: string | null): Pick<ShareCardSpec, "footer" | "accent" | "teamLogo"> => ({ footer: `${host}/boundary-banter`, accent, teamLogo });

  const summary = listCard({
    id: "week",
    label: "The week",
    kicker: `Boundary Banter · ${week}`,
    title: report.headline,
    rows: [],
    facts: report.numbers.slice(0, 3).map((n) => ({ label: shortLabel(n.label), value: n.value })),
  });
  // The star of the day leads the week's card when there's a photo.
  const starPhoto = report.star ? photos[report.star.name] ?? null : null;
  summary.spec = {
    ...summary.spec,
    results: report.matches.map((m) => resultRow(m.innings, m.winner, m.winner ? margin(m.result) : null)),
    // No crest up top: the masthead carries the club's, and the tiles get the room.
    emblem: undefined,
    ...base(teamByName(report.star?.team)?.primary),
    ...(report.star && starPhoto ? { person: { name: report.star.name, photo: starPhoto }, emblem: undefined } : {}),
    byline: "Boundary Banter",
    team: report.venue,
  };
  summary.text = `${report.headline}\n${report.dek}\n${url}`;

  const matchCard = (m: DayMatch): SheetCard => {
    const [a, b] = m.innings;
    const win = teamByName(m.winner);
    const potm = m.potm;
    return {
      id: `match-${m.matchNo}`,
      label: `Match ${m.matchNo}`,
      text: `${m.headline}\n${a.team} ${a.runs}/${a.wickets} · ${b.team} ${b.runs}/${b.wickets} — ${m.result}\n${url}#match-${m.matchNo}`,
      spec: {
        ...base(win?.primary, win?.logo),
        kicker: `Match ${m.matchNo} · ${m.kicker}`,
        title: m.headline,
        figures: [
          { value: `${a.runs}/${a.wickets}`, unit: `${a.team} · ${ov(a.balls)} ov` },
          { value: `${b.runs}/${b.wickets}`, unit: `${b.team} · ${ov(b.balls)} ov` },
        ],
        body: m.result,
        person: potm ? { name: potm.name, photo: photos[potm.name] ?? null, color: teamByName(potm.team)?.primary } : null,
        // Bat and ball sit on a line each (the card wraps at " · ") so neither shrinks.
        facts: potm ? [{ label: "Player of the Match", value: potm.name }, { label: "Figures", value: potm.line.replace(/\s+and\s+/, " · ") }] : undefined,
        byline: `${week}`,
        team: "Boundary Banter",
      },
    };
  };

  const star = report.star;
  const starCard: SheetCard | null = star
    ? {
        id: "star",
        label: "Star of the day",
        text: `Star of ${week}: ${star.name}, ${star.line}.\n${url}`,
        spec: {
          ...base(teamByName(star.team)?.primary, teamByName(star.team)?.logo),
          kicker: `Star of the day · ${week}`,
          title: star.name,
          ...(figuresOf(star.line).length > 1
            ? { figures: figuresOf(star.line) }
            : figuresOf(star.line).length === 1
              ? { hero: { ...figuresOf(star.line)[0], colors: GOLD } }
              : { subtitle: star.line }),
          body: star.blurb,
          person: { name: star.name, photo: photos[star.name] ?? null, color: teamByName(star.team)?.primary },
          team: star.team,
        },
      }
    : null;

  const numbers = listCard({
    id: "numbers",
    label: "The day in numbers",
    kicker: `The day in numbers · ${week}`,
    title: `${report.venue}, by the numbers`,
    rows: report.numbers.map((n) => ({ name: n.label.charAt(0).toUpperCase() + n.label.slice(1), value: n.value, plain: true })),
  });
  numbers.spec = { ...numbers.spec, ...base(), byline: "Boundary Banter", team: week };

  const table = listCard({
    id: "table",
    label: "The table",
    kicker: `Season ${report.season} table · after Week ${report.week}`,
    title: report.table[0] ? `${report.table[0].team} top the table` : "The table",
    rows: report.table.map((t) => teamRow(t.team, `${t.points} pts`, `P${t.played} W${t.won} · NRR ${t.nrr > 0 ? "+" : ""}${t.nrr.toFixed(2)}`)),
  });
  table.spec = { ...table.spec, accent: teamByName(report.table[0]?.team)?.primary };
  table.spec = { ...table.spec, ...base(), byline: "Boundary Banter", team: week };

  const matches = report.matches.map(matchCard);
  const ordered = first ? [...matches.filter((c) => c.id === `match-${first}`), summary, ...matches.filter((c) => c.id !== `match-${first}`)] : [summary, ...matches];
  return [...ordered, ...(starCard ? [starCard] : []), numbers, ...(report.table.length ? [table] : [])];
}

export default function ReportShare({ report, photos, match, dark, label, className }: { report: DayReport; photos: Record<string, string | null>; match?: number; dark?: boolean; label?: string; className?: string }) {
  return (
    <SectionShare
      build={() => reportCards(report, photos, match)}
      fileBase={`jcc-banter-s${report.season}-w${report.week}${match ? `-m${match}` : ""}`}
      label={label ?? (match ? "Share this match" : "Share the week")}
      dark={dark}
      className={className}
    />
  );
}

/** The week's card from the index page's preview (no full report loaded there). */
export function previewCard(r: DayPreview): SheetCard {
  const week = `Season ${r.season} · Week ${r.week}`;
  const card = listCard({
    id: "week",
    label: `Week ${r.week}`,
    kicker: `Boundary Banter · ${week}`,
    title: r.headline,
    rows: [],
    facts: r.star ? [{ label: "Star of the day", value: r.star }, { label: "Venue", value: r.venue }] : [{ label: "Venue", value: r.venue }],
  });
  // No crest up top: the masthead carries the club's, and the tiles get the room.
  card.spec = { ...card.spec, emblem: undefined, results: r.matches.map((m) => resultRow(m.scores, m.winner, m.margin)) };
  card.spec = { ...card.spec, footer: `${window.location.host}/boundary-banter`, byline: "Boundary Banter", team: week };
  card.text = `${r.headline}\n${r.dek}\n${window.location.origin}/boundary-banter/${r.slug}`;
  return card;
}

export function PreviewShare({ preview }: { preview: DayPreview }) {
  return <SectionShare build={() => [previewCard(preview)]} fileBase={`jcc-banter-s${preview.season}-w${preview.week}`} label="Share the week" />;
}

/** Jumps to a match's scorecard fold further down the page and opens it. */
export function ScorecardLink({ match }: { match: number }) {
  return (
    <a
      href={`#scorecard-${match}`}
      onClick={(e) => {
        const fold = document.getElementById(`scorecard-${match}`);
        if (!(fold instanceof HTMLDetailsElement)) return;
        e.preventDefault();
        fold.open = true;
        fold.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#scorecard-${match}`);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-jcc-blue/15 px-3.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-jcc-blue/80 transition-colors duration-300 hover:border-jcc-blue hover:bg-jcc-blue hover:text-[#FCFBF8]"
    >
      <ListOrdered size={12} /> Full scorecard
    </a>
  );
}
