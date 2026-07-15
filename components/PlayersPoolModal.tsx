"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, X, Search } from "lucide-react";
import { TEAMS } from "@/lib/teams";
import type { PlayerPoolRow } from "@/lib/series";

interface PlayersPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerPoolRow[];
}

export default function PlayersPoolModal({ isOpen, onClose, players }: PlayersPoolModalProps) {
  const [search, setSearch] = useState("");

  // Plain `overflow: hidden` on body doesn't reliably block wheel/touch scroll
  // in every browser — pinning body to `position: fixed` at the current scroll
  // offset is the robust lock, then we restore the exact scroll position on close.
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const body = document.body.style;
    const prev = { position: body.position, top: body.top, left: body.left, right: body.right, width: body.width, overflow: body.overflow };
    body.position = "fixed";
    body.top = `-${scrollY}px`;
    body.left = "0";
    body.right = "0";
    body.width = "100%";
    body.overflow = "hidden";
    return () => {
      body.position = prev.position;
      body.top = prev.top;
      body.left = prev.left;
      body.right = prev.right;
      body.width = prev.width;
      body.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
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
              className="theme-static-light bg-white rounded-[32px] border border-jcc-border shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto"
            >
              <div className="p-8 bg-jcc-navy-deep border-b border-jcc-border relative">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-jcc-border flex items-center justify-center shadow-sm">
                    <Users className="w-8 h-8 text-jcc-gold" />
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-white transition-colors"
                  >
                    <X className="w-5 h-5 text-jcc-text-muted" />
                  </button>
                </div>
                <h3 className="text-xl font-bold text-jcc-navy mb-2">Players Pool</h3>
                <p className="text-[14px] text-jcc-text-muted font-medium mb-6">
                  Every player who has ever featured in a recorded scorecard — {players.length} in total.
                </p>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-text-muted" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white border border-jcc-border focus:border-jcc-accent outline-none transition-all text-sm font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 max-h-[420px] overflow-y-auto pr-4 scrollbar-thin">
                {filtered.length > 0 ? (
                  <div className="grid gap-2">
                    {filtered.map((p, i) => (
                      <div
                        key={p.name}
                        className="flex items-center gap-4 py-3.5 pl-5 pr-5 rounded-2xl bg-white border border-jcc-border"
                      >
                        <span className="w-7 shrink-0 text-center font-mono font-black text-xs text-jcc-text-muted">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-jcc-navy truncate">{p.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {p.teams.map((teamId) => (
                              <span
                                key={teamId}
                                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border"
                                style={{
                                  color: TEAMS[teamId].primary,
                                  borderColor: `${TEAMS[teamId].primary}40`,
                                  backgroundColor: `${TEAMS[teamId].primary}0D`,
                                }}
                              >
                                {TEAMS[teamId].shortName}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono font-black text-jcc-accent-dark text-lg">{p.matches}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted">
                            {p.matches === 1 ? "Match" : "Matches"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <Users className="w-10 h-10 text-jcc-text-muted mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-bold text-jcc-text-muted">No players found.</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-jcc-border bg-jcc-navy-deep/50">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-white border border-jcc-border text-jcc-text-muted font-bold text-sm hover:text-jcc-navy transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
