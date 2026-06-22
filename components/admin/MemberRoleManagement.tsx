"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Star, User, Loader2, AlertCircle, Search, Trophy, Phone, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getDiceBearUrl } from "@/lib/avatar";

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

  if (loading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-jcc-accent opacity-20" /></div>;
  if (!match) return <div className="p-20 text-center text-white/20 font-black uppercase tracking-[0.2em] premium-card border-white/5">No tactical engagement detected for role management.</div>;

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white font-[var(--font-heading)] uppercase tracking-tight">Match Leadership</h2>
          <p className="text-[13px] text-white/50 font-medium uppercase tracking-widest mt-1">Command Assignment for {new Date(match.match_date).toLocaleDateString()}</p>
        </div>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-jcc-accent transition-colors" />
          <input
            type="text"
            placeholder="Search roster..."
            className="pl-11 pr-4 py-3 rounded-2xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white uppercase tracking-widest w-full sm:w-72 placeholder:text-white/10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }} 
            exit={{ opacity: 0, height: 0 }}
            className="p-5 rounded-2xl bg-jcc-ball-red/10 border border-jcc-ball-red/20 flex items-center gap-3 text-jcc-ball-red text-[13px] font-black uppercase tracking-widest"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredPlayers.length > 0 ? filteredPlayers.map((player) => {
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
            <div key={player.player_id} className="premium-card p-6 flex flex-col sm:flex-row xl:flex-col 2xl:flex-row sm:items-center xl:items-start 2xl:items-center justify-between gap-6 group">
              <div className="flex items-start gap-5 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
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
                  <h4 className="text-[17px] font-black text-white mb-1 truncate uppercase tracking-tight">{player.name || "Unknown Player"}</h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-white/40 font-black uppercase tracking-widest">
                      <Phone className="w-3.5 h-3.5" /> {player.phone}
                    </span>
                    <span className="text-[11px] font-black text-jcc-accent uppercase tracking-[0.15em]">
                      {player.cricket_role}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${
                      player.status === "registered" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/10" : "bg-jcc-gold/10 text-jcc-gold border-jcc-gold/10"
                    }`}>
                      {player.status}
                    </span>
                    {team && team !== "Unassigned" && (
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${
                        team === "Mavericks" ? "bg-[#E8A820]/10 text-[#E8A820] border-[#E8A820]/20" :
                        team === "NeuroStrikers" ? "bg-[#3B6FC4]/10 text-[#3B6FC4] border-[#3B6FC4]/20" :
                        team === "The Outliers" ? "bg-[#1A7A5E]/10 text-[#1A7A5E] border-[#1A7A5E]/20" :
                        "bg-white/5 text-white/30 border-white/10"
                      }`}>
                        {team}
                      </span>
                    )}
                    {memberTag === "founding-member" && (
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-jcc-gold/10 text-jcc-gold border border-jcc-gold/20 shadow-[0_0_10px_rgba(255,184,0,0.1)]">
                        <Star className="w-3.5 h-3.5 fill-jcc-gold text-jcc-gold" /> Founding
                      </span>
                    )}
                    {leadershipRole !== "player" && (
                      <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-lg ${
                        leadershipRole === "captain" ? "bg-jcc-gold text-black border-jcc-gold" : "bg-jcc-accent text-black border-jcc-accent"
                      }`}>
                        {leadershipRole === "captain" ? <Trophy className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                        {leadershipRole}
                      </span>
                    )}
                  </div>
                  
                  {/* Extra Profile Details (Batting, Bowling, Bio) */}
                  {(battingStyle || bowlingStyle || shortBio) && (
                    <div className="mt-3 pt-3 border-t border-white/5 space-y-2 text-[11px]">
                      {(battingStyle || bowlingStyle) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {battingStyle && battingStyle !== "Unassigned" && (
                            <span className="text-white/40 uppercase font-black tracking-widest">
                              <span className="text-white/20 font-medium lowercase tracking-normal mr-1">bat:</span>
                              <span className="text-jcc-accent">{battingStyle}</span>
                            </span>
                          )}
                          {bowlingStyle && bowlingStyle !== "Unassigned" && (
                            <span className="text-white/40 uppercase font-black tracking-widest">
                              <span className="text-white/20 font-medium lowercase tracking-normal mr-1">bowl:</span>
                              <span className="text-[#22E6A3]">{bowlingStyle}</span>
                            </span>
                          )}
                        </div>
                      )}
                      {shortBio && (
                        <p className="italic text-white/30 font-medium tracking-wide leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
                          "{shortBio}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-start xl:justify-between 2xl:justify-start gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/5 shrink-0 w-full sm:w-auto xl:w-full 2xl:w-auto self-stretch sm:self-center xl:self-stretch 2xl:self-center shadow-inner">
                {[
                  { role: "captain", icon: Trophy, label: "Captain", activeClass: "bg-jcc-gold text-black shadow-[0_0_20px_rgba(255,184,0,0.3)]" },
                  { role: "vice-captain", icon: Star, label: "VC", activeClass: "bg-jcc-accent text-black shadow-[0_0_20px_rgba(0,224,255,0.3)]" },
                  { role: "player", icon: User, label: "Reset", activeClass: "bg-white/10 text-white shadow-lg" },
                ].map((r) => (
                  <button
                    key={r.role}
                    disabled={updating === player.player_id}
                    onClick={() => updateRole(player.player_id, r.role)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-500 flex-1 sm:flex-initial xl:flex-1 2xl:flex-initial ${
                      leadershipRole === r.role 
                        ? r.activeClass 
                        : "text-white/20 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {updating === player.player_id && leadershipRole !== r.role ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <r.icon className="w-4 h-4" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-24 text-center premium-card border-white/5">
            <Info className="w-12 h-12 text-white/5 mx-auto mb-5" />
            <p className="text-white/40 font-black text-sm tracking-[0.3em] uppercase">NO SQUAD DATA DETECTED</p>
            <p className="text-[11px] text-white/20 mt-2 uppercase tracking-widest">Awaiting tactical registration sequence.</p>
          </div>
        )}
      </div>
    </div>
  );
}
