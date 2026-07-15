"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Star, User, Loader2, AlertCircle, Search, Trophy, Phone, ShieldOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getDiceBearUrl } from "@/lib/avatar";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSkeleton from "@/components/admin/AdminSkeleton";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

interface Match {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  location_map_url: string;
  player_limit: number;
  status: string;
}

interface PlayerRegistration {
  player_id: string;
  name: string;
  phone: string;
  cricket_role: string;
  status: string;
  players?: {
    image_url: string | null;
    team: string | null;
    member_tag: string | null;
    batting_style: string | null;
    bowling_style: string | null;
    short_bio: string | null;
  } | {
    image_url: string | null;
    team: string | null;
    member_tag: string | null;
    batting_style: string | null;
    bowling_style: string | null;
    short_bio: string | null;
  }[] | null;
}

interface MatchRole {
  player_id: string;
  role: string;
  match_id: string;
}

const TEAM_BADGE: Record<string, string> = {
  Mavericks: "bg-jcc-accent-dark/10 text-jcc-accent-dark border-jcc-accent-dark/25",
  NeuroStrikers: "bg-jcc-blue/10 text-jcc-blue border-jcc-blue/20",
  "The Outliers": "bg-[#1A7A5E]/10 text-[#1A7A5E] border-[#1A7A5E]/25",
};

export default function MemberRoleManagement({ adminPassword }: { adminPassword?: string }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<PlayerRegistration[]>([]);
  const [matchRoles, setMatchRoles] = useState<MatchRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // 1. Get latest upcoming match
      const { data: matchData, error: mError } = await supabase
        .from("matches")
        .select("*")
        .order("match_date", { ascending: false })
        .limit(1)
        .single();

      if (mError && mError.code !== "PGRST116") throw mError;

      if (!matchData) {
        setMatch(null);
        setPlayers([]);
        setMatchRoles([]);
        return;
      }
      setMatch(matchData);

      // 2. Get registrations for this match (including phone and status, and join players for full profile & team status details)
      const { data: regData, error: rError } = await supabase
        .from("registrations")
        .select(`
          player_id,
          name,
          phone,
          cricket_role,
          status,
          players:player_id (
            image_url,
            team,
            member_tag,
            batting_style,
            bowling_style,
            short_bio
          )
        `)
        .eq("match_id", matchData.id);

      if (rError) throw rError;
      setPlayers(regData || []);

      // 3. Get leadership roles assigned for THIS match
      const { data: roleData, error: roleError } = await supabase
        .from("match_player_roles")
        .select("*")
        .eq("match_id", matchData.id);

      if (roleError) throw roleError;
      setMatchRoles(roleData || []);
    } catch (err: unknown) {
      console.error("Critical Error fetching admin data:", err);
      setError(err instanceof Error ? err.message : "Failed to load squad data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const getLeadershipRole = (playerId: string) => {
    return matchRoles.find(r => r.player_id === playerId)?.role || "player";
  };

  const updateRole = async (playerId: string, newRole: string) => {
    setError(null);
    if (!match) return;

    setUpdating(playerId);
    try {
      // Call the secure API route instead of direct Supabase write
      const response = await fetch("/api/admin/assign-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({
          match_id: match.id,
          player_id: playerId,
          role: newRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update role");
      }

      if (newRole === "player") {
        setMatchRoles(matchRoles.filter(r => r.player_id !== playerId));
      } else {
        const existing = matchRoles.find(r => r.player_id === playerId);
        if (existing) {
          setMatchRoles(matchRoles.map(r => r.player_id === playerId ? { ...r, role: newRole } : r));
        } else {
          setMatchRoles([...matchRoles, { player_id: playerId, role: newRole, match_id: match.id }]);
        }
      }
    } catch (err: unknown) {
      console.error("Role update error:", err);
      setError(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader title="Match Leadership" subtitle="Command Assignment" />
        <AdminSkeleton rows={3} rowHeight="140px" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="space-y-8">
        <AdminPageHeader title="Match Leadership" subtitle="Command Assignment" />
        <div className="premium-card">
          <AdminEmptyState icon={ShieldOff} title="No fixture scheduled" description="Set up the next Sunday match to assign captaincy and leadership roles." />
        </div>
      </div>
    );
  }

  const filteredPlayers = players
    .filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search)
    )
    .sort((a, b) => {
      const roleA = getLeadershipRole(a.player_id);
      const roleB = getLeadershipRole(b.player_id);

      const getRolePriority = (role: string) => {
        if (role === "captain") return 1;
        if (role === "vice-captain") return 2;
        return 3;
      };

      const priorityA = getRolePriority(roleA);
      const priorityB = getRolePriority(roleB);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Match Leadership"
        subtitle={`Command Assignment for ${new Date(match.match_date).toLocaleDateString()}`}
        toolbar={
          <div className="admin-search-wrap w-full sm:w-96">
            <Search className="admin-search-icon w-4 h-4" />
            <input
              type="text"
              placeholder="Search members, phone number, role or team..."
              className="admin-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-5 rounded-2xl bg-jcc-danger/8 border border-jcc-danger/20 flex items-center gap-3 text-jcc-danger text-[13px] font-black uppercase tracking-widest"
          >
            <AlertCircle className="w-5 h-5" strokeWidth={1.5} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredPlayers.length > 0 ? filteredPlayers.map((player, index) => {
          const leadershipRole = getLeadershipRole(player.player_id);

          // Resolve player profile data safely supporting both single object or array return structures from Supabase
          const pData = player.players
            ? (Array.isArray(player.players) ? player.players[0] : player.players)
            : null;

          const imageUrl = pData?.image_url;
          const team = pData?.team;
          const memberTag = pData?.member_tag;
          const battingStyle = pData?.batting_style;
          const bowlingStyle = pData?.bowling_style;
          const shortBio = pData?.short_bio;

          return (
            <motion.div
              key={player.player_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="premium-card p-6 flex flex-col sm:flex-row xl:flex-col 2xl:flex-row sm:items-center xl:items-start 2xl:items-center justify-between gap-6 group"
            >
              <div className="flex items-start gap-5 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-jcc-navy-light border border-jcc-border-bright flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                  <img
                    src={imageUrl || getDiceBearUrl(player.name, team)}
                    alt={player.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const fallback = getDiceBearUrl(player.name, team);
                      if (img.src !== fallback) img.src = fallback;
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[17px] font-black text-jcc-blue mb-1 truncate uppercase tracking-tight">{player.name || "Unknown Player"}</h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-jcc-text-muted font-black uppercase tracking-widest">
                      <Phone className="w-3.5 h-3.5" strokeWidth={1.5} /> {player.phone}
                    </span>
                    <span className="text-[11px] font-black text-jcc-accent-dark uppercase tracking-[0.15em]">
                      {player.cricket_role}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${
                      player.status === "registered" ? "bg-jcc-accent/10 text-jcc-accent-dark border-jcc-accent/25" : "bg-jcc-navy-light text-jcc-text-muted border-jcc-border-bright"
                    }`}>
                      {player.status}
                    </span>
                    {team && team !== "Unassigned" && (
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${TEAM_BADGE[team] || "bg-jcc-navy-light text-jcc-text-muted border-jcc-border-bright"}`}>
                        {team}
                      </span>
                    )}
                    {memberTag === "founding-member" && (
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-jcc-accent/10 text-jcc-accent-dark border border-jcc-accent/25">
                        <Star className="w-3.5 h-3.5 fill-jcc-accent-dark text-jcc-accent-dark" /> Founding
                      </span>
                    )}
                    {leadershipRole !== "player" && (
                      <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-sm ${
                        leadershipRole === "captain" ? "bg-jcc-accent text-jcc-blue border-jcc-accent" : "bg-jcc-accent/20 text-jcc-accent-dark border-jcc-accent/40"
                      }`}>
                        {leadershipRole === "captain" ? <Trophy className="w-3 h-3" strokeWidth={1.5} /> : <Star className="w-3 h-3" strokeWidth={1.5} />}
                        {leadershipRole}
                      </span>
                    )}
                  </div>

                  {/* Extra Profile Details (Batting, Bowling, Bio) */}
                  {(battingStyle || bowlingStyle || shortBio) && (
                    <div className="mt-3 pt-3 border-t border-jcc-border space-y-2 text-[11px]">
                      {(battingStyle || bowlingStyle) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {battingStyle && battingStyle !== "Unassigned" && (
                            <span className="text-jcc-text-muted uppercase font-black tracking-widest">
                              <span className="font-medium lowercase tracking-normal mr-1 opacity-60">bat:</span>
                              <span className="text-jcc-accent-dark">{battingStyle}</span>
                            </span>
                          )}
                          {bowlingStyle && bowlingStyle !== "Unassigned" && (
                            <span className="text-jcc-text-muted uppercase font-black tracking-widest">
                              <span className="font-medium lowercase tracking-normal mr-1 opacity-60">bowl:</span>
                              <span className="text-[#1A7A5E]">{bowlingStyle}</span>
                            </span>
                          )}
                        </div>
                      )}
                      {shortBio && (
                        <p className="italic text-jcc-text-muted font-medium tracking-wide leading-relaxed bg-jcc-navy-light p-2.5 rounded-xl border border-jcc-border">
                          &ldquo;{shortBio}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-start xl:justify-between 2xl:justify-start gap-2 p-1.5 rounded-2xl bg-jcc-navy-light border border-jcc-border-bright shrink-0 w-full sm:w-auto xl:w-full 2xl:w-auto self-stretch sm:self-center xl:self-stretch 2xl:self-center shadow-inner">
                {[
                  { role: "captain", icon: Trophy, label: "Captain", activeClass: "bg-jcc-accent text-jcc-blue shadow-[0_0_16px_rgba(212,175,55,0.35)]" },
                  { role: "vice-captain", icon: Star, label: "VC", activeClass: "bg-jcc-accent/25 text-jcc-accent-dark shadow-sm" },
                  { role: "player", icon: User, label: "Reset", activeClass: "bg-jcc-blue text-white shadow-sm" },
                ].map((r) => (
                  <button
                    key={r.role}
                    disabled={updating === player.player_id}
                    onClick={() => updateRole(player.player_id, r.role)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-500 flex-1 sm:flex-initial xl:flex-1 2xl:flex-initial ${
                      leadershipRole === r.role
                        ? r.activeClass
                        : "text-jcc-text-muted hover:text-jcc-blue hover:bg-jcc-accent/8"
                    }`}
                  >
                    {updating === player.player_id && leadershipRole !== r.role ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <r.icon className="w-4 h-4" strokeWidth={1.5} />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{r.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          );
        }) : (
          <div className="col-span-full premium-card">
            <AdminEmptyState icon={User} title="No squad data" description="Players who register for this fixture will appear here for leadership assignment." />
          </div>
        )}
      </div>
    </div>
  );
}
