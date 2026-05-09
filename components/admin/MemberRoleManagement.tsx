"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Shield, Star, User, Loader2, CheckCircle2, AlertCircle, Search, Trophy, Phone, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MemberRoleManagement({ adminPassword }: { adminPassword?: string }) {
  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [matchRoles, setMatchRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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

      // 2. Get registrations for this match (including phone and status)
      const { data: regData, error: rError } = await supabase
        .from("registrations")
        .select("player_id, name, phone, cricket_role, status")
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
    } catch (err: any) {
      console.error("Critical Error fetching admin data:", err);
      setError(err.message || "Failed to load squad data.");
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err: any) {
      console.error("Role update error:", err);
      setError(err.message || "Failed to update role.");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-jcc-blue" /></div>;
  if (!match) return <div className="p-8 text-center text-jcc-muted font-bold">No match found to manage roles.</div>;

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-jcc-navy font-[var(--font-heading)]">Match Leadership</h2>
          <p className="text-[12px] text-jcc-muted font-medium">Assign leadership roles for the match on {new Date(match.match_date).toLocaleDateString()}.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-muted" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            className="pl-10 pr-4 py-2.5 rounded-xl bg-white border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium w-full sm:w-72"
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
            className="p-4 rounded-xl bg-jcc-red/[0.06] border border-jcc-red/15 flex items-center gap-3 text-jcc-red text-[13px] font-bold"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filteredPlayers.length > 0 ? filteredPlayers.map((player) => {
          const leadershipRole = getLeadershipRole(player.player_id);
          return (
            <div key={player.player_id} className="glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-jcc-blue/20 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-jcc-bg border border-jcc-border flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-jcc-muted" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[15px] font-bold text-jcc-navy mb-0.5 truncate">{player.name}</h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                    <span className="flex items-center gap-1 text-[11px] text-jcc-muted font-medium">
                      <Phone className="w-3 h-3" /> {player.phone}
                    </span>
                    <span className="text-[11px] font-bold text-jcc-blue-deep uppercase tracking-widest">
                      {player.cricket_role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      player.status === "confirmed" ? "bg-jcc-turf/[0.06] text-jcc-turf border-jcc-turf/10" : "bg-jcc-gold/[0.06] text-jcc-gold border-jcc-gold/10"
                    }`}>
                      {player.status}
                    </span>
                    {leadershipRole !== "player" && (
                      <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        leadershipRole === "captain" ? "bg-jcc-gold text-white border-jcc-gold" : "bg-jcc-purple text-white border-jcc-purple"
                      }`}>
                        {leadershipRole === "captain" ? <Trophy className="w-2.5 h-2.5" /> : <Star className="w-2.5 h-2.5" />}
                        {leadershipRole}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-jcc-bg border border-jcc-border shrink-0 self-end sm:self-center">
                {[
                  { role: "captain", icon: Trophy, label: "Captain" },
                  { role: "vice-captain", icon: Star, label: "VC" },
                  { role: "player", icon: User, label: "Reset" },
                ].map((r) => (
                  <button
                    key={r.role}
                    disabled={updating === player.player_id}
                    onClick={() => updateRole(player.player_id, r.role)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${
                      leadershipRole === r.role 
                        ? "bg-jcc-blue-deep text-white shadow-lg" 
                        : "text-jcc-muted hover:bg-white hover:text-jcc-navy"
                    }`}
                  >
                    {updating === player.player_id && leadershipRole !== r.role ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <r.icon className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-20 text-center glass-card bg-jcc-bg/30">
            <Info className="w-8 h-8 text-jcc-muted mx-auto mb-3 opacity-30" />
            <p className="text-jcc-muted font-bold text-sm tracking-wide">NO PLAYERS REGISTERED FOR THIS MATCH</p>
            <p className="text-[11px] text-jcc-muted mt-1">New registrations will appear here automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
