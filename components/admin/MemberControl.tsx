"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Users, UserPlus, Search, Edit2, 
  Star, Activity, Loader2, Save, X, Clock,
  ChevronRight, Phone, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Player {
  id: string;
  name: string;
  phone: string;
  cricket_role: string;
  team: string;
  member_tag: string;
  group_role: string;
  is_active: boolean;
  approval_status: string;
  image_url?: string;
  short_bio?: string;
  batting_style?: string;
  bowling_style?: string;
  created_at: string;
}

export default function MemberControl({ adminPassword }: { adminPassword?: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<Partial<Player> | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [view, setView] = useState<"all" | "pending">("all");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  async function fetchPlayers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlayers(data || []);
    } catch (err) {
      console.error("Error fetching players:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPlayers();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleApproval = async (id: string, action: "approve" | "reject") => {
    setIsProcessing(id);
    try {
      const response = await fetch(`/api/admin/players/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error(`${action} failed`);

      fetchPlayers();
    } catch (err) {
      console.error(`Error during ${action}:`, err);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaving(true);

    const endpoint = isAdding ? "/api/admin/players/create" : "/api/admin/players/update";
    if (!editingPlayer) return;
    const body = isAdding ? { ...editingPlayer, approval_status: 'approved' } : { id: editingPlayer.id, updates: editingPlayer };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Operation failed");

      fetchPlayers();
      setEditingPlayer(null);
      setIsAdding(false);
    } catch (err) {
      console.error("Error saving player:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this member?`)) return;

    try {
      const response = await fetch("/api/admin/players/deactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      });

      if (response.ok) {
        fetchPlayers();
      }
    } catch (err) {
      console.error("Error toggling player status:", err);
    }
  };

  const handleTeamUpdate = async (id: string, newTeam: string) => {
    setIsProcessing(id);
    try {
      const response = await fetch("/api/admin/players/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({ id, updates: { team: newTeam } }),
      });

      if (!response.ok) throw new Error("Team update failed");

      setPlayers(players.map(p => p.id === id ? { ...p, team: newTeam } : p));
    } catch (err) {
      console.error("Error updating team:", err);
    } finally {
      setIsProcessing(null);
    }
  };

  const pendingPlayers = players.filter(p => p.approval_status === "pending");
  const approvedPlayers = players.filter(p => p.approval_status === "approved");

  const filteredPlayers = (view === "all" ? approvedPlayers : pendingPlayers).filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.phone.includes(search)
  );

  if (loading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-jcc-accent opacity-20" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white font-[var(--font-heading)] uppercase tracking-tight">Member Management</h2>
          <p className="text-[13px] text-white/50 font-medium uppercase tracking-widest mt-1">Personnel & Profile Operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl mr-2 shadow-inner">
            <button 
              onClick={() => setView("all")}
              className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all uppercase tracking-widest ${view === "all" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white/60"}`}
            >
              Active ({approvedPlayers.length})
            </button>
            <button 
              onClick={() => setView("pending")}
              className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all relative uppercase tracking-widest ${view === "pending" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white/60"}`}
            >
              Pending ({pendingPlayers.length})
              {pendingPlayers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-jcc-ball-red rounded-full border-2 border-black" />
              )}
            </button>
          </div>
          <button
            onClick={() => { setEditingPlayer({ 
              name: "", phone: "", cricket_role: "all-rounder", 
              team: "Unassigned", member_tag: "member", group_role: "member",
              batting_style: "Right Hand", bowling_style: "Right Arm Pace", is_active: true
            }); setIsAdding(true); }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl btn-vibrant-blue text-black font-black text-[12px] transition-all uppercase tracking-widest shadow-lg"
          >
            <UserPlus className="w-4 h-4" /> Add Member
          </button>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-jcc-accent transition-colors" />
        <input
          type="text"
          placeholder="Search by name or contact passcode..."
          className="w-full pl-14 pr-6 py-4.5 rounded-2xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black shadow-inner placeholder:text-white/10 uppercase tracking-widest"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredPlayers.map((player) => (
          <motion.div 
            layout
            key={player.id} 
            className={`premium-card p-6 group relative overflow-hidden flex items-center gap-6 ${!player.is_active && 'opacity-40 grayscale'}`}
          >
            {/* Avatar - Fixed */}
            <div className="w-20 h-20 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative">
              {player.image_url ? (
                <img src={player.image_url} alt={player.name} className="w-full h-full object-cover" />
              ) : (
                <Users className="w-8 h-8 text-white/5" />
              )}
              {player.member_tag === 'founding-member' && (
                <div className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10">
                  <Star className="w-3.5 h-3.5 text-jcc-gold fill-jcc-gold" />
                </div>
              )}
            </div>

            {/* Content - Flexible */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h3 className="text-xl font-black text-white uppercase tracking-tight truncate max-w-full leading-none">{player.name}</h3>
                {player.approval_status === 'pending' && <Clock className="w-3.5 h-3.5 text-jcc-accent shrink-0 animate-pulse" />}
              </div>
              
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-white/30 uppercase tracking-widest">
                  <Phone className="w-3.5 h-3.5 text-jcc-accent" /> {player.phone}
                </div>
                <div className="px-2.5 py-0.5 rounded-md bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-widest border border-white/10">
                  {player.cricket_role}
                </div>
              </div>

              {/* Direct Team Selector */}
              <div className="flex items-center gap-3">
                <div className="relative group/select">
                  <select
                    disabled={isProcessing === player.id}
                    value={player.team || "Unassigned"}
                    onChange={(e) => handleTeamUpdate(player.id, e.target.value)}
                    className={`appearance-none pl-3 pr-8 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all outline-none cursor-pointer ${
                      player.team === 'Mavericks' ? 'bg-[#00C2FF] text-[#061826] border-white/20' : 
                      player.team === 'NeuroStrikers' ? 'bg-[#22E6A3] text-[#061826] border-white/20' : 
                      'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <option value="Unassigned" className="bg-[#0F2740] text-white">Unassigned</option>
                    <option value="Mavericks" className="bg-[#0F2740] text-white">Mavericks</option>
                    <option value="NeuroStrikers" className="bg-[#0F2740] text-white">NeuroStrikers</option>
                  </select>
                  <ChevronRight className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-90 pointer-events-none transition-colors ${
                    (player.team === 'Mavericks' || player.team === 'NeuroStrikers') ? 'text-[#061826]' : 'text-white/20'
                  }`} />
                  {isProcessing === player.id && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    </div>
                  )}
                </div>
                
                {player.approval_status === "rejected" && (
                  <span className="px-2.5 py-1 rounded-lg bg-jcc-ball-red/10 text-jcc-ball-red text-[9px] font-black uppercase tracking-widest border border-jcc-ball-red/20">
                    Rejected
                  </span>
                )}
              </div>
              
              {player.approval_status === "pending" && (
                <div className="flex gap-2 mt-4">
                  <button
                    disabled={isProcessing === player.id}
                    onClick={() => handleApproval(player.id, "approve")}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-400 text-black text-[10px] font-black uppercase tracking-widest hover:bg-emerald-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing === player.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                  <button
                    disabled={isProcessing === player.id}
                    onClick={() => handleApproval(player.id, "reject")}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-jcc-ball-red text-[10px] font-black uppercase tracking-widest hover:bg-jcc-ball-red hover:text-black transition-all disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>

            {/* Actions - Fixed Right */}
            <div className="flex flex-col gap-2 shrink-0">
              <button 
                onClick={() => { setEditingPlayer(player); setIsAdding(false); }}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-jcc-accent hover:bg-jcc-accent/10 transition-all flex items-center justify-center shadow-lg backdrop-blur-md"
              >
                <Edit2 className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={() => handleDeactivate(player.id, player.is_active)}
                className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 transition-all flex items-center justify-center shadow-lg backdrop-blur-md ${player.is_active ? 'text-white/40 hover:text-jcc-ball-red hover:bg-jcc-ball-red/10' : 'text-[#22E6A3] bg-[#22E6A3]/10 border-[#22E6A3]/20'}`}
              >
                <Activity className="w-4.5 h-4.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {editingPlayer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="premium-card w-full max-w-2xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border-white/20"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    {isAdding ? "Register Personnel" : "Edit Profile"}
                  </h3>
                  {!isAdding && <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">{editingPlayer?.name}</p>}
                </div>
                <button onClick={() => setEditingPlayer(null)} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors">
                  <X className="w-6 h-6 text-white/20" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 sm:p-10 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] px-1">Full Identity</label>
                    <input 
                      required
                      className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black shadow-inner"
                      value={editingPlayer?.name || ""}
                      onChange={e => setEditingPlayer(prev => prev ? {...prev, name: e.target.value} : null)}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] px-1">Contact Link</label>
                    <input 
                      required
                      className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black shadow-inner"
                      value={editingPlayer?.phone || ""}
                      onChange={e => setEditingPlayer(prev => prev ? {...prev, phone: e.target.value} : null)}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] px-1">Specialization</label>
                    <select 
                      className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black shadow-inner appearance-none"
                      value={editingPlayer?.cricket_role || ""}
                      onChange={e => setEditingPlayer(prev => prev ? {...prev, cricket_role: e.target.value} : null)}
                    >
                      <option value="all-rounder" className="bg-[#050E17]">All-Rounder</option>
                      <option value="batter" className="bg-[#050E17]">Batter</option>
                      <option value="bowler" className="bg-[#050E17]">Bowler</option>
                      <option value="wicketkeeper" className="bg-[#050E17]">Wicketkeeper</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] px-1">Tactical Deployment</label>
                    <select 
                      className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black shadow-inner appearance-none"
                      value={editingPlayer?.team || ""}
                      onChange={e => setEditingPlayer(prev => prev ? {...prev, team: e.target.value} : null)}
                    >
                      <option value="Unassigned" className="bg-[#050E17]">Unassigned</option>
                      <option value="Mavericks" className="bg-[#050E17]">Mavericks</option>
                      <option value="NeuroStrikers" className="bg-[#050E17]">NeuroStrikers</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] px-1">Service Tag</label>
                    <select 
                      className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black shadow-inner appearance-none"
                      value={editingPlayer?.member_tag || ""}
                      onChange={e => setEditingPlayer(prev => prev ? {...prev, member_tag: e.target.value} : null)}
                    >
                      <option value="member" className="bg-[#050E17]">Member</option>
                      <option value="founding-member" className="bg-[#050E17]">Founding Member</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] px-1">Command Authority</label>
                    <select 
                      className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black shadow-inner appearance-none"
                      value={editingPlayer?.group_role || ""}
                      onChange={e => setEditingPlayer(prev => prev ? {...prev, group_role: e.target.value} : null)}
                    >
                      <option value="member" className="bg-[#050E17]">Member</option>
                      <option value="captain" className="bg-[#050E17]">Captain</option>
                      <option value="vice-captain" className="bg-[#050E17]">Vice Captain</option>
                      <option value="founding-member" className="bg-[#050E17]">Founding Member</option>
                      <option value="admin" className="bg-[#050E17]">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] px-1">Personnel Dossier</label>
                  <textarea 
                    rows={3}
                    className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black shadow-inner resize-none placeholder:text-white/10"
                    value={editingPlayer?.short_bio || ""}
                    onChange={e => setEditingPlayer(prev => prev ? {...prev, short_bio: e.target.value} : null)}
                    placeholder="Brief history of achievements..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-6">
                  <button
                    disabled={saving}
                    type="submit"
                    className="w-full sm:flex-1 py-5 rounded-2xl btn-vibrant-blue text-black font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest shadow-xl"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Identity
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="w-full sm:w-auto px-12 py-5 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-black text-sm hover:text-white transition-all uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
