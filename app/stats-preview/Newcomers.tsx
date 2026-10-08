"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { createSigningMatcher, type Signing } from "@/lib/auction-squads";
import { fmtDate, leaderboardRows, type BoardRow, type CardData } from "@/lib/scorecard-dashboard/profile";
import { TEAMS, teamByName, type TeamId } from "@/lib/teams";
import { Avatar } from "./Avatar";
import { Counter, usePill } from "./motion";

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";
const SEASON = 3;

/** Lakhs, printed the way the auction sheet does: 640 → "6.4Cr", 25 → "25L". */
const price = (lakh: number) => (lakh >= 100 ? `${+(lakh / 100).toFixed(2)}Cr` : `${lakh}L`);

type Newcomer = {
  p: number;
  name: string;
  team: string;
  debut: string;
  row: BoardRow | undefined;
  signing: Signing | null;
};

/**
 * Season 3's newcomers: everyone on a Season 3 scorecard who isn't on any
 * Season 2 scorecard, set against the Season 3 auction sheet. The export
 * starts at Season 2, so "new" means new since then.
 */
export function useNewcomers(data: CardData) {
  return useMemo(() => {
    const seasonsOf = new Map<number, Set<number>>();
    const firstS3 = new Map<number, { m: number; team: string }>();
    for (const [m, p, team] of data.present) {
      const season = data.matches[m].season;
      (seasonsOf.get(p) ?? seasonsOf.set(p, new Set()).get(p)!).add(season);
      if (season === SEASON) {
        const cur = firstS3.get(p);
        if (!cur || data.matches[m].date < data.matches[cur.m].date) firstS3.set(p, { m, team });
      }
    }
    const rows = new Map(leaderboardRows(data, [SEASON]).map((r) => [r.p, r]));
    const signingFor = createSigningMatcher();

    const fresh: Newcomer[] = [...firstS3.entries()]
      .filter(([p]) => !seasonsOf.get(p)!.has(SEASON - 1))
      .map(([p, first]) => ({
        p,
        name: data.players[p],
        team: rows.get(p)?.team ?? first.team,
        debut: data.matches[first.m].date,
        row: rows.get(p),
        signing: signingFor(data.players[p]),
      }))
      .sort((a, b) => (b.row?.matches ?? 0) - (a.row?.matches ?? 0) || a.debut.localeCompare(b.debut));

    return { fresh };
  }, [data]);
}

export default function Newcomers({ data, onOpenPlayer }: { data: CardData; onOpenPlayer: (p: number) => void }) {
  const { fresh } = useNewcomers(data);
  const [team, setTeam] = useState<"all" | string>("all");
  const { box, pill } = usePill(team, "line");

  const viaAuction = fresh.filter((n) => n.signing);
  const walkIns = fresh.filter((n) => !n.signing);
  const byTeam = (Object.keys(TEAMS) as TeamId[]).map((id) => {
    const name = TEAMS[id].name;
    return { id, name, logo: TEAMS[id].logo, people: fresh.filter((n) => n.team === name) };
  });
  const shown = team === "all" ? fresh : fresh.filter((n) => n.team === team);
  const debutDays = new Set(fresh.map((n) => n.debut)).size;

  return (
    <div>
      {/* ── The headline ── */}
      <div data-reveal className="grid items-end gap-10 rounded-[1.75rem] bg-jcc-blue ring-1 ring-[#FCFBF8]/10 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] p-6 md:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <p className={LABEL}>New this season</p>
          <div className="mt-4 flex items-end gap-4">
            <span
              className="font-heading text-[5.5rem] font-bold leading-[0.78] tracking-[-0.06em] tabular-nums sm:text-[7rem] md:text-[9rem]"
              style={{ backgroundImage: "linear-gradient(135deg,#F3C96A,#D4AF37 45%,#A97824)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
            >
              <Counter value={fresh.length} />
            </span>
            <span className="pb-2 font-heading text-xl font-bold leading-tight tracking-tight text-white sm:pb-3 sm:text-2xl">
              new players
              <br />
              <span className="text-jcc-text-muted">played Season 3</span>
            </span>
          </div>
          <p className="mt-5 max-w-md text-[13.5px] leading-relaxed text-jcc-text-muted">
            Everyone on a Season 3 scorecard who never appeared in Season 2, matched against the Season 3 auction sheet.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 sm:gap-6">
          {([
            [viaAuction.length, "Bought at auction"],
            [walkIns.length, "Joined after"],
            [debutDays, "Debut matchdays"],
          ] as const).map(([v, l]) => (
            <div key={l} className="min-w-0 border-l border-[#FCFBF8]/15 pl-3 sm:pl-5">
              <dd className="font-heading text-4xl font-bold leading-none tracking-[-0.05em] tabular-nums text-white sm:text-5xl">
                <Counter value={v} />
              </dd>
              <dt className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-jcc-text-muted">{l}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* ── By club ── */}
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 rounded-[1.75rem] bg-jcc-blue ring-1 ring-[#FCFBF8]/10 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] p-5 sm:gap-x-6 sm:p-6 md:grid-cols-4 md:p-8">
        {byTeam.map((t) => (
          <button key={t.id} data-reveal onClick={() => setTeam(team === t.name ? "all" : t.name)} className="group min-w-0 text-left">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center"><Image src={t.logo} alt="" width={48} height={48} className="max-h-12 w-auto object-contain transition-transform duration-500 group-hover:scale-110" /></span>
              <div className="min-w-0 max-w-full">
                <div className="truncate font-heading text-base font-bold leading-tight tracking-tight text-white sm:text-lg">{t.name}</div>
                <div className="font-mono text-[10.5px] text-jcc-text-muted">{t.people.length} new</div>
              </div>
            </div>
            <div className="mt-4 flex -space-x-1.5">
              {t.people.slice(0, 8).map((n, i) => (
                <span key={n.p} className={`shrink-0 rounded-full ring-2 ring-[#FCFBF8]/35 ${i >= 3 ? "hidden sm:flex" : "flex"}`}>
                  <Avatar name={n.name} size={36} />
                </span>
              ))}
              {t.people.length > 3 && <span className="grid h-9 place-items-center pl-3 font-mono text-[11px] text-jcc-text-muted sm:hidden">+{t.people.length - 3}</span>}
              {t.people.length > 8 && <span className="hidden h-9 place-items-center pl-3 font-mono text-[11px] text-jcc-text-muted sm:grid">+{t.people.length - 8}</span>}
            </div>
          </button>
        ))}
      </div>

      {/* ── The arrivals ── */}
      <div className={"mt-6 rounded-[1.75rem] bg-jcc-blue ring-1 ring-[#FCFBF8]/10 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] px-4 pt-5 sm:px-6 sm:pt-6 md:px-10 md:pt-8"}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#FCFBF8]/15">
        <div ref={box} className="no-scrollbar relative flex min-w-0 max-w-full touch-pan-x gap-6 overflow-x-auto overscroll-x-contain">
          {["all", ...byTeam.map((t) => t.name)].map((k) => (
            <button
              key={k}
              data-active={team === k}
              onClick={() => setTeam(k)}
              className={`whitespace-nowrap pb-4 text-[14px] font-semibold tracking-tight transition-colors duration-300 ${team === k ? "text-white" : "text-jcc-text-muted hover:text-white"}`}
            >
              {k === "all" ? `All ${fresh.length}` : k}
            </button>
          ))}
          <span ref={pill} aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full bg-jcc-accent" style={{ opacity: 0 }} />
        </div>
        <span className={`${LABEL} mb-4 hidden sm:inline`}>Most matches first · tap for their cards</span>
      </div>

      <ol className="mt-2 grid grid-cols-1 gap-x-10 pb-4 md:grid-cols-2">
        {shown.map((n) => {
          const r = n.row;
          const s = n.signing;
          return (
            <li key={n.p} data-row className="min-w-0">
              <button onClick={() => onOpenPlayer(n.p)} className="group relative flex w-full items-center gap-3 border-b sm:gap-4 border-[#FCFBF8]/10 py-4 text-left">
                <span aria-hidden className="pointer-events-none absolute -inset-x-3 inset-y-1 rounded-xl bg-[#FCFBF8]/[0.06] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative">
                  <Avatar name={n.name} size={52} ring={teamByName(n.team)?.primary ?? "#A97824"} className="transition-transform duration-500 group-hover:scale-105" />
                  {teamByName(n.team) && (
                    <span className="absolute -bottom-1 -right-1.5 rounded-full bg-[#FCFBF8] p-0.5 shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
                      <Image src={teamByName(n.team)!.logo} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                    </span>
                  )}
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 max-w-full truncate font-heading text-base sm:text-lg font-bold tracking-tight text-white">{n.name}</span>
                    {s ? (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${s.guest ? "bg-[#FCFBF8]/12 text-[#FCFBF8]/85" : "bg-jcc-accent/25 text-jcc-accent-highlight"}`}>
                        {s.guest ? "Guest" : "Signed"} · {price(s.sold)}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-dashed border-[#FCFBF8]/30 px-2 py-0.5 font-mono text-[10px] text-[#FCFBF8]/70">Not on sheet</span>
                    )}
                  </span>
                  <span className="mt-1 block truncate font-mono text-[10.5px] text-jcc-text-muted">
                    Debut {fmtDate(n.debut)} · {n.team}
                  </span>
                </span>
                <span className="relative grid shrink-0 grid-cols-[22px_32px_30px] gap-1.5 text-right sm:grid-cols-[40px_52px_44px] sm:gap-2">
                  {([
                    [r?.matches ?? 0, "M"],
                    [r?.runs ?? 0, "Runs"],
                    [r?.wk ?? 0, "Wkts"],
                  ] as const).map(([v, l]) => (
                    <span key={l}>
                      <span className="block font-heading text-lg font-bold tabular-nums text-white sm:text-xl">{v}</span>
                      <span className="block font-mono text-[8.5px] uppercase tracking-[0.08em] sm:text-[9.5px] sm:tracking-[0.12em] text-jcc-text-muted">{l}</span>
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      </div>

      <p className="mt-6 max-w-3xl rounded-xl bg-jcc-blue/80 px-4 py-3 font-mono text-[11px] leading-relaxed text-[#FCFBF8]/75">
        The scorecard export starts at Season 2, so &ldquo;new&rdquo; means first seen in Season 3. Auction matches use the same rule as the Seasons page: a name both lists answer to unambiguously; a name that could be two signings, or carries a surname the sheet doesn&apos;t, is shown as not on the sheet.
      </p>
    </div>
  );
}
