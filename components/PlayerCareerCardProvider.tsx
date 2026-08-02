"use client";

// Wraps a subtree of scorecard-driven UI and gives it one thing: a way to open
// a player's career card off nothing but the name a scorecard spelled out. The
// name is resolved onto the club roster with the same matcher /members and the
// players pool use — a hit opens the shared career card
// (components/PlayerStatsModal.tsx), a miss surfaces a toast instead of a dead
// click, since most scorecard names belong to guests with no member profile.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UserX } from "lucide-react";
import PlayerStatsModal, { type CareerCardSubject } from "@/components/PlayerStatsModal";
import type { PlayerStats } from "@/components/MemberCard";
import { createRosterMatcher, type ClubRosterRow } from "@/lib/club-roster";
import { buildStatsLookup, lookupPlayerStats } from "@/lib/player-stats-lookup";
import type {
  BattingLeaderRow,
  BowlingLeaderRow,
  MVPRow,
  FieldingRow,
} from "@/lib/series";

/** No-op default so a consumer outside the provider fails silently, not loudly. */
export const PlayerClickContext = createContext<(name: string) => void>(() => {});

export function usePlayerClick() {
  return useContext(PlayerClickContext);
}

interface PlayerCareerCardProviderProps {
  clubRoster: ClubRosterRow[];
  careerLeaderboards: {
    batting: BattingLeaderRow[];
    bowling: BowlingLeaderRow[];
    mvp: MVPRow[];
    fielding: FieldingRow[];
  };
  children: React.ReactNode;
}

export default function PlayerCareerCardProvider({
  clubRoster,
  careerLeaderboards,
  children,
}: PlayerCareerCardProviderProps) {
  const matcher = useMemo(() => createRosterMatcher(clubRoster), [clubRoster]);
  const statsLookup = useMemo(() => buildStatsLookup(careerLeaderboards), [careerLeaderboards]);
  const [selectedRow, setSelectedRow] = useState<ClubRosterRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const handlePlayerClick = useCallback(
    (name: string) => {
      const row = matcher.find(name);
      if (!row) {
        setToast(`${name} hasn't registered as a JCC member yet.`);
        return;
      }
      setSelectedRow(row);
    },
    [matcher],
  );

  const subject: CareerCardSubject | null = selectedRow
    ? {
        name: selectedRow.name,
        image: selectedRow.image_url,
        team: selectedRow.team ?? "Unassigned",
        role: selectedRow.role ?? "Member",
        shortBio: selectedRow.short_bio,
        battingStyle: selectedRow.batting_style,
        bowlingStyle: selectedRow.bowling_style,
        joinedDate: selectedRow.joined_date,
      }
    : null;

  const stats: PlayerStats | undefined = selectedRow
    ? lookupPlayerStats(statsLookup, selectedRow.name)
    : undefined;

  return (
    <PlayerClickContext.Provider value={handlePlayerClick}>
      {children}

      <AnimatePresence>
        {subject && (
          <PlayerStatsModal member={subject} stats={stats} onClose={() => setSelectedRow(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[240] px-5 py-3 rounded-full flex items-center gap-2.5 max-w-[min(90vw,26rem)]"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-jcc-navy) 92%, transparent)",
              border: "1.5px solid color-mix(in srgb, white 20%, transparent)",
              boxShadow: "0 12px 32px -12px rgba(0,0,0,0.5)",
            }}
          >
            <UserX className="w-3.5 h-3.5 text-white/60 shrink-0" />
            <p className="text-white/85 text-xs font-bold truncate">{toast}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </PlayerClickContext.Provider>
  );
}
