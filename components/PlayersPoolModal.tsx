"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, X, Search } from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { TEAMS } from "@/lib/teams";
import { photoFor, type PlayerPhotoMap } from "@/lib/player-photos";
import {
  buildPlayersPool,
  createRosterMatcher,
  type ClubRosterRow,
} from "@/lib/club-roster";
import type { PlayerPoolRow } from "@/lib/series";

interface PlayersPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Who actually featured in THIS season, derived from its scorecards. */
  players: PlayerPoolRow[];
  /** Names the season list, e.g. "Season 3". */
  seasonLabel?: string;
  /** The club's maintained roster (the `players` table). */
  roster?: ClubRosterRow[];
  /** Every season's scorecard pool — what the roster's career counts come from. */
  careerPool?: PlayerPoolRow[];
  photos?: PlayerPhotoMap;
}

type PoolTab = "season" | "club";

export default function PlayersPoolModal({
  isOpen,
  onClose,
  players,
  seasonLabel = "This Season",
  roster = [],
  careerPool = [],
  photos = {},
}: PlayersPoolModalProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<PoolTab>("season");
  // The overlay is portalled to <body>, so it can't be shifted or clipped by an
  // ancestor's transform/overflow. Portals need the DOM, hence the mount gate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Plain `overflow: hidden` on body doesn't reliably block wheel/touch scroll
  // in every browser — pinning body to `position: fixed` at the current scroll
  // offset is the robust lock, then we restore the exact scroll position on close.
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const body = document.body.style;
    // Pinning the body also removes the page scrollbar, which widens the layout
    // and pushes the (viewport-sized) overlay past the right edge — pad it back.
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const prev = { position: body.position, top: body.top, left: body.left, right: body.right, width: body.width, overflow: body.overflow, paddingRight: body.paddingRight };
    body.position = "fixed";
    body.top = `-${scrollY}px`;
    body.left = "0";
    body.right = "0";
    body.width = "100%";
    body.overflow = "hidden";
    if (gutter > 0) body.paddingRight = `${gutter}px`;
    return () => {
      body.position = prev.position;
      body.top = prev.top;
      body.left = prev.left;
      body.right = prev.right;
      body.width = prev.width;
      body.overflow = prev.overflow;
      body.paddingRight = prev.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Members and non-members in one list — see buildPlayersPool().
  const allPlayers = useMemo(
    () => buildPlayersPool(roster, careerPool),
    [roster, careerPool],
  );
  // A season row is a scorecard name, so it needs the same member test.
  const matcher = useMemo(() => createRosterMatcher(roster), [roster]);

  const q = search.toLowerCase();
  const seasonRows = players.filter((p) => p.name.toLowerCase().includes(q));
  const clubRows = allPlayers.filter((p) => p.name.toLowerCase().includes(q));
  const showClub = tab === "club" && allPlayers.length > 0;
  const count = showClub ? clubRows.length : seasonRows.length;
  const memberCount = allPlayers.filter((p) => p.isMember).length;

  const tabs: { id: PoolTab; label: string; n: number }[] = [
    { id: "season", label: seasonLabel, n: players.length },
    { id: "club", label: "All Players", n: allPlayers.length },
  ];

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999]"
          />

          <div className="fixed inset-0 flex items-center justify-center p-4 z-[1000] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="theme-static-navy bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] rounded-[28px] border border-jcc-border shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden pointer-events-auto"
            >
              <div className="px-6 pt-7 pb-1 bg-jcc-navy-deep relative shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-jcc-border flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-jcc-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white leading-tight">Players Pool</h3>
                    <p className="text-[12px] text-jcc-text-muted font-medium leading-tight">
                      {showClub
                        ? `${allPlayers.length} ever recorded · ${memberCount} members · ${allPlayers.length - memberCount} non-members`
                        : `${players.length} featured in a ${seasonLabel} scorecard`}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="p-2 -mr-2 rounded-xl hover:bg-white/10 transition-colors shrink-0"
                  >
                    <X className="w-5 h-5 text-jcc-text-muted" />
                  </button>
                </div>

                <div className="relative mt-5">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-text-muted" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-jcc-border text-white placeholder:text-white/35 focus:border-jcc-accent outline-none transition-all text-sm font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {allPlayers.length > 0 && (
                  <div className="flex mt-5">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex-1 pb-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                          tab === t.id
                            ? "text-jcc-accent border-b-2 border-jcc-accent"
                            : "text-white/30 hover:text-white/55 border-b-2 border-transparent"
                        }`}
                      >
                        {t.label}
                        <span className="ml-1.5 font-mono text-white/25">{t.n}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 p-3 overflow-y-auto overflow-x-hidden scrollbar-thin">
                {count > 0 ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                    {showClub
                      ? clubRows.map((p, i) => (
                          <PoolRow
                            key={p.key}
                            index={i + 1}
                            name={p.name}
                            image={p.image}
                            matches={p.matches}
                            team={null}
                            isMember={p.isMember}
                          >
                            {p.isMember ? (
                              p.role && (
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/15 text-white/50">
                                  {p.role}
                                </span>
                              )
                            ) : (
                              <NonMemberTag />
                            )}
                          </PoolRow>
                        ))
                      : seasonRows.map((p, i) => (
                          <PoolRow
                            key={p.name}
                            index={i + 1}
                            name={p.name}
                            image={photoFor(photos, p.name)}
                            matches={p.matches}
                            team={
                              p.teams[0] ? (TEAMS[p.teams[0]]?.name ?? null) : null
                            }
                            isMember={matcher.find(p.name) !== null}
                          >
                            {matcher.find(p.name) === null && <NonMemberTag />}
                            {p.teams.map((teamId) => (
                              <span
                                key={teamId}
                                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border"
                                style={{
                                  color: TEAMS[teamId].primary,
                                  borderColor: `${TEAMS[teamId].primary}55`,
                                  backgroundColor: `${TEAMS[teamId].primary}1A`,
                                }}
                              >
                                {TEAMS[teamId].shortName}
                              </span>
                            ))}
                          </PoolRow>
                        ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <Users className="w-10 h-10 text-jcc-text-muted mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-bold text-jcc-text-muted">No players found.</p>
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Marks someone who has played but has no `players` profile behind him. */
function NonMemberTag() {
  return (
    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-white/35">
      Non-member
    </span>
  );
}

/** One person, in either list. `children` carries the list-specific chips. */
function PoolRow({
  index,
  name,
  image,
  matches,
  team,
  isMember,
  children,
}: {
  index: number;
  name: string;
  image: string | null;
  matches: number;
  /** Team NAME (not id) — only used to seed the generated avatar's palette. */
  team: string | null;
  isMember: boolean;
  children?: React.ReactNode;
}) {
  return (
    // A grid item defaults to `min-width: auto`, so without min-w-0 the row
    // refuses to shrink below its min-content width and punches out through the
    // panel's right edge. overflow-hidden then keeps the chips inside the card.
    <div className="min-w-0 overflow-hidden flex items-center gap-3 py-2 pl-3 pr-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-jcc-accent/30 transition-colors">
      <span className="w-5 shrink-0 text-center font-mono font-black text-[11px] text-white/30">
        {index}
      </span>
      {isMember ? (
        <PlayerAvatar
          src={image}
          name={name}
          team={team}
          displaySize={72}
          className="w-8 h-8 rounded-full overflow-hidden shrink-0"
          treatment="natural"
        />
      ) : (
        // No photo and no generated avatar: a non-member has no profile, and a
        // face here would imply one.
        <span className="w-8 h-8 rounded-full shrink-0 border border-dashed border-white/10" />
      )}
      {/* Name and chips share one line — the chips wrap under it only when the
          name is long enough to need the whole row. */}
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* min-w-0 lets truncate actually kick in; the basis floor makes the
            chips wrap to a second line instead of squeezing the name away. */}
        <p className="min-w-0 flex-1 basis-32 text-sm font-bold text-white truncate">
          {name}
        </p>
        {children}
      </div>
      <div className="shrink-0 flex items-baseline gap-1 whitespace-nowrap">
        {matches > 0 ? (
          <>
            <span className="font-mono font-black text-jcc-accent text-base leading-none">
              {matches}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted">
              {matches === 1 ? "Match" : "Matches"}
            </span>
          </>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-widest text-white/25">
            Yet to play
          </span>
        )}
      </div>
    </div>
  );
}
