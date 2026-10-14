import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Crown,
  Download,
  FileText,
  Heart,
  Newspaper,
  Shield,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";
import RevealMotion from "@/components/RevealMotion";
import Jaali from "@/components/Jaali";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { TEAMS } from "@/lib/teams";
import { getClubStatistics } from "@/lib/statistics";
import { fetchSeasons } from "@/lib/seasons";
import { createRosterMatcher } from "@/lib/club-roster";
import { parseFocus, withFocus } from "@/lib/photo-focus";
import {
  getGovernanceRoleLabel,
  type GovernanceFields,
} from "@/lib/member-role";

// About JCC — who we are, how we're run, what we stand for. Server-rendered:
// the numbers come from the same statistics service as the home page, and the
// committee from the players table's governance fields
// (supabase/add_governance_fields.sql), so neither can drift from the rest of
// the site.

export const revalidate = 300;

export const metadata: Metadata = {
  title: "About · Jaipur Cricket Circle",
  description: "Who we are, how JCC is run, and what we stand for — United by Cricket, Defined by Character.",
};

type CommitteeMember = GovernanceFields & { id: string; image_url?: string | null; team?: string | null };

// Every committee member, and every photo, comes from the players table. Each
// photo carries its framing so the face sits centred, as on /members and /stats.
async function getCommittee(): Promise<CommitteeMember[]> {
  const { data } = await supabaseAdmin.from("players").select("*").eq("approval_status", "approved");
  return (data ?? [])
    .filter((p) => p.is_core_committee || p.is_exec_committee)
    .map((p) => ({
      id: p.id,
      name: p.name,
      image_url: p.image_url ? withFocus(p.image_url, parseFocus(p.image_focus)) : null,
      team: p.team,
      governance_role: p.governance_role,
      is_core_committee: !!p.is_core_committee,
      is_exec_committee: !!p.is_exec_committee,
      group_role: p.group_role,
      governance_order: p.governance_order,
    }))
    .sort((a, b) => (a.governance_order ?? 99) - (b.governance_order ?? 99));
}

const MISSION = [
  "Organise fair and enjoyable cricket matches and tournaments.",
  "Provide opportunities for players of all skill levels.",
  "Promote sportsmanship, discipline and mutual respect.",
  "Value participation as much as performance.",
  "Keep raising the quality and professionalism of every event.",
];

const VALUES = [
  { icon: Shield, title: "Sportsmanship", desc: "Respect the result, accept the decision, and treat every player with dignity — on the field and off it." },
  { icon: Target, title: "Integrity", desc: "We compete honestly. No manipulated results, no unsporting conduct — ever." },
  { icon: Users, title: "Inclusivity", desc: "Open to everyone who shares our values. Turning up matters as much as performing." },
  { icon: Zap, title: "Accountability", desc: "Every member owns their actions. Commitment to the Circle means showing up — for the game and for each other." },
  { icon: Heart, title: "Community First", desc: "Rivalries are healthy. But the Circle always comes before the team." },
  { icon: Newspaper, title: "Storytelling", desc: "Every match has a story. Boundary Banter makes sure this community's history is never forgotten." },
];

const LABEL = "text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em]";

export default async function AboutPage() {
  const [committee, club, seasons] = await Promise.all([getCommittee(), getClubStatistics(), fetchSeasons()]);

  // Captains are this season's, from season_teams — not players.group_role,
  // which still names whoever led a side in an earlier season.
  const active = seasons.find((s) => s.status === "active");
  const matcher = createRosterMatcher(
    committee.map((m) => ({ id: m.id, name: m.name ?? "", image_url: null, team: null, role: null })),
  );
  const captainOf = new Map<string, string>();
  for (const t of active?.teams ?? []) {
    const row = t.captain ? matcher.find(t.captain) : null;
    if (row) captainOf.set(row.id, TEAMS[t.team_id]?.name ?? t.team_id);
  }
  const core = committee.filter((m) => m.is_core_committee);
  const executive = committee.filter((m) => m.is_core_committee || m.is_exec_committee);

  const stats = [
    { value: String(club.approvedMembers), label: "Active Members" },
    { value: String(club.matchesPlayed), label: "Matches Played" },
    { value: String(club.weeksPlayed), label: "Weeks Played" },
    { value: "∞", label: "Community Love" },
  ];

  return (
    <RevealMotion className="overflow-x-clip">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="theme-static-dark section-bg-royal relative overflow-hidden page-top pb-16 sm:pb-24">
        <Jaali />
        <div data-parallax="0.3" className="pointer-events-none absolute -right-40 -top-40 h-136 w-136 rounded-full bg-jcc-accent/15 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 -left-32 h-120 w-120 rounded-full bg-[#3B6FC4]/25 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl px-5 sm:px-8 pt-10 sm:pt-16">
          <p data-reveal className={`${LABEL} inline-flex items-center gap-2 text-jcc-accent`}>
            <Star className="h-3.5 w-3.5" /> About JCC · Community Charter v1.0
          </p>
          <h1 data-reveal className="mt-8 font-heading text-[clamp(2.8rem,8vw,7rem)] font-bold leading-[0.92] tracking-[-0.04em] text-white">
            United by cricket.
            <br />
            <span className="text-white/45">Defined by </span>
            <span className="text-gradient-cyan">character.</span>
          </h1>
          <p data-reveal className="mt-8 max-w-2xl text-lg leading-relaxed text-white/70">
            Five friends, one ball, an ordinary Sunday in March 2026. Today Jaipur Cricket Circle is a league, a
            committee, a newsroom and a weekly ritual — run so that everyone else can just turn up and play.
          </p>

          <dl data-reveal-stagger className="mt-14 grid grid-cols-2 border-t border-white/15 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className={`py-6 sm:py-8 ${i > 0 ? "sm:border-l sm:border-white/15 sm:pl-6" : ""} ${i % 2 ? "border-l border-white/15 pl-5 sm:pl-6" : ""}`}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">{s.label}</dt>
                <dd className="mt-3 font-heading text-4xl font-bold leading-none tracking-[-0.04em] tabular-nums text-white sm:text-6xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Vision & mission ────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div data-reveal>
          <p className={`${LABEL} text-jcc-accent-dark`}>Our vision</p>
          <p className="mt-6 font-heading text-3xl font-bold leading-[1.15] tracking-[-0.02em] text-jcc-blue sm:text-4xl">
            Jaipur&apos;s most welcoming amateur cricket community — where people play{" "}
            <span className="text-jcc-accent-dark">competitive cricket</span>, make friends, stay active and build
            memories that last.
          </p>
        </div>
        <div data-reveal>
          <p className={`${LABEL} text-jcc-accent-dark`}>Our mission</p>
          <ol className="mt-6 divide-y divide-jcc-blue/10 border-y border-jcc-blue/10">
            {MISSION.map((m, i) => (
              <li key={m} className="group flex gap-5 py-4">
                <span className="font-mono text-xs font-bold tabular-nums text-jcc-accent-dark pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[15px] font-medium leading-relaxed text-jcc-blue/80 transition-colors group-hover:text-jcc-blue">{m}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Values ──────────────────────────────────────────────────────── */}
      <section className="bg-jcc-navy-light/60 border-y border-jcc-blue/5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={`${LABEL} text-jcc-accent-dark`}>What we stand for</p>
              <h2 className="mt-4 font-heading text-4xl font-bold tracking-[-0.03em] text-jcc-blue sm:text-5xl">Six values, no exceptions.</h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-jcc-text-muted">We play with respect, compete with integrity, and grow together as a community.</p>
          </div>
          <div data-reveal-stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v, i) => (
              <article key={v.title} className="group relative overflow-hidden rounded-2xl border border-jcc-blue/10 bg-jcc-navy p-7 transition-all duration-300 hover:-translate-y-1 hover:border-jcc-accent/40 hover:shadow-[0_20px_50px_-20px_rgba(18,35,63,0.25)]">
                <span aria-hidden className="absolute -right-2 -top-6 font-heading text-[7rem] font-bold leading-none text-jcc-blue/[0.04] transition-colors group-hover:text-jcc-accent/10">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-jcc-accent/10 text-jcc-accent-dark transition-transform group-hover:scale-110">
                  <v.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 font-heading text-2xl font-bold tracking-[-0.02em] text-jcc-blue">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-jcc-text-muted">{v.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Governance ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div data-reveal className="max-w-2xl">
          <p className={`${LABEL} text-jcc-accent-dark`}>How we&apos;re run</p>
          <h2 className="mt-4 font-heading text-4xl font-bold tracking-[-0.03em] text-jcc-blue sm:text-5xl">The people behind the Circle.</h2>
          <p className="mt-4 text-base leading-relaxed text-jcc-text-muted">
            A Core Committee sets the direction; an Executive Committee runs the weeks. Decisions of the Core
            Committee are final and binding on all matters of governance.
          </p>
        </div>

        {core.length > 0 && (
          <>
            <p className={`${LABEL} mt-14 flex items-center gap-2 text-jcc-blue/75`}>
              <Crown className="h-3.5 w-3.5 text-jcc-accent-dark" /> Core Committee
            </p>
            <div data-reveal-stagger className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {core.map((m) => (
                <article key={m.id} className="group relative overflow-hidden rounded-2xl border border-jcc-accent/25 bg-jcc-blue-deep">
                  <div className="aspect-4/5 overflow-hidden">
                    <PlayerAvatar
                      src={m.image_url}
                      name={m.name ?? ""}
                      team={m.team}
                      className="h-full w-full transition-transform duration-700 group-hover:scale-105"
                      imgClassName="h-full w-full object-cover"
                      focusBox={0.8}
                    />
                  </div>
                  <div className="theme-static-dark absolute inset-x-0 bottom-0 bg-linear-to-t from-[#0D1728] via-[#0D1728]/80 to-transparent p-4 pt-14">
                    <p className="font-heading text-lg font-bold leading-tight text-white">{m.name}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-jcc-accent">{getGovernanceRoleLabel(m)}</p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {executive.length > 0 && (
          <>
            <p className={`${LABEL} mt-14 flex items-center gap-2 text-jcc-blue/75`}>
              <Users className="h-3.5 w-3.5 text-jcc-accent-dark" /> Executive Committee
            </p>
            <div data-reveal-stagger className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {executive.map((m) => (
                <article key={m.id} className="flex items-center gap-4 rounded-2xl border border-jcc-blue/10 bg-jcc-navy p-3 pr-5 transition-colors hover:border-jcc-accent/40">
                  <PlayerAvatar
                    src={m.image_url}
                    name={m.name ?? ""}
                    team={m.team}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-xl"
                    imgClassName="h-full w-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-lg font-bold leading-tight text-jcc-blue">{m.name}</p>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-jcc-text-muted">
                      {m.is_core_committee ? "Core Committee" : "Executive Committee"} · {getGovernanceRoleLabel(m)}
                    </p>
                  </div>
                  {captainOf.has(m.id) && (
                    <span
                      title={`Captain, ${captainOf.get(m.id)}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-jcc-accent/30 bg-jcc-accent/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-jcc-accent-dark"
                    >
                      <Trophy className="h-3 w-3" /> {captainOf.get(m.id)} captain
                    </span>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Charter ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <div data-reveal className="theme-static-dark section-bg-royal relative overflow-hidden rounded-3xl p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-jcc-accent/20 blur-[90px]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-jcc-accent/40 bg-jcc-accent/10">
              <FileText className="h-8 w-8 text-jcc-accent" />
            </span>
            <div className="flex-1">
              <p className={`${LABEL} text-jcc-accent`}>Community Charter · v1.0 · 20 June 2026</p>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">The rulebook of the Circle.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
                Vision, mission, governance, conduct standards, tournament policy and financial principles — the
                governing document every member signs up to.
              </p>
            </div>
            <a
              href="/documents/JCC_Community_Charter.pdf"
              target="_blank"
              rel="noopener noreferrer"
              download
              className="btn-vibrant-blue inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-4 text-xs font-black uppercase tracking-widest"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </div>
        </div>
      </section>

      {/* ── Explore ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div data-reveal-stagger className="grid gap-4 md:grid-cols-3">
          {[
            { href: "/boundary-banter", icon: Newspaper, title: "Boundary Banter", desc: "Matchday reports, features and the occasional roast — every week's drama on the record." },
            { href: "/stats", icon: BarChart3, title: "Stats", desc: "Every scorecard, ranked the IPL way. Leaderboards, player cards and the season so far." },
            { href: "/members", icon: Users, title: "Members", desc: "The faces of the Circle — founders, committee, captains and everyone who turns up." },
          ].map((x) => (
            <Link key={x.href} href={x.href} className="group flex flex-col rounded-2xl border border-jcc-blue/10 bg-jcc-navy p-7 transition-all duration-300 hover:-translate-y-1 hover:border-jcc-accent/40 hover:shadow-[0_20px_50px_-20px_rgba(18,35,63,0.25)]">
              <span className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-jcc-accent/10 text-jcc-accent-dark">
                  <x.icon className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-5 w-5 text-jcc-blue/70 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-jcc-accent-dark" />
              </span>
              <h3 className="mt-6 font-heading text-2xl font-bold tracking-[-0.02em] text-jcc-blue">{x.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-jcc-text-muted">{x.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </RevealMotion>
  );
}
