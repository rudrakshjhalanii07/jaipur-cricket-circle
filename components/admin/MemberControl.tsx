"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Users, UserPlus, Search, Edit2, Trash2, Shield, 
  Trophy, Star, Activity, Loader2, Save, X, Clock,
  ChevronRight, Phone, Mail, Award, CheckCircle2, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MemberControl({ adminPassword }: { adminPassword?: string }) {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const [view, setView] = useState<"all" | "pending">("all");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
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
  };

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
    setStatus("idle");

    const endpoint = isAdding ? "/api/admin/players/create" : "/api/admin/players/update";
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

      setStatus("success");
      fetchPlayers();
      setEditingPlayer(null);
      setIsAdding(false);
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      console.error("Error saving player:", err);
      setStatus("error");
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

  const pendingPlayers = players.filter(p => p.approval_status === "pending");
  const approvedPlayers = players.filter(p => p.approval_status === "approved");

  const filteredPlayers = (view === "all" ? approvedPlayers : pendingPlayers).filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.phone.includes(search)
  );

  if (loading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-jcc-blue opacity-20" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-jcc-navy">Member Management</h2>
          <p className="text-[12px] text-jcc-muted font-medium">Approve requests and manage player profiles.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-jcc-bg border border-jcc-border rounded-xl mr-2">
            <button 
              onClick={() => setView("all")}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${view === "all" ? "bg-white text-jcc-navy shadow-sm border border-jcc-border" : "text-jcc-muted"}`}
            >
              Members ({approvedPlayers.length})
            </button>
            <button 
              onClick={() => setView("pending")}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all relative ${view === "pending" ? "bg-white text-jcc-navy shadow-sm border border-jcc-border" : "text-jcc-muted"}`}
            >
              Pending ({pendingPlayers.length})
              {pendingPlayers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-jcc-red rounded-full" />
              )}
            </button>
          </div>
          <button
            onClick={() => { setEditingPlayer({ 
              name: "", phone: "", cricket_role: "all-rounder", 
              team: "Unassigned", member_tag: "member", group_role: "member",
              batting_style: "Right Hand", bowling_style: "Right Arm Pace", is_active: true
            }); setIsAdding(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-jcc-navy text-white font-bold text-[12px] hover:bg-jcc-blue transition-all"
          >
            <UserPlus className="w-4 h-4" /> Add Member
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-muted" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlayers.map((player) => (
          <motion.div 
            layout
            key={player.id} 
            className={`glass-card p-5 group relative overflow-hidden ${!player.is_active && 'opacity-60 grayscale'}`}
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-jcc-bg border border-jcc-border flex items-center justify-center overflow-hidden shrink-0">
                {player.image_url ? (
                  <img src={player.image_url} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-6 h-6 text-jcc-muted opacity-30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-jcc-navy truncate">{player.name}</h3>
                  {player.member_tag === 'founding-member' && <Star className="w-3 h-3 text-jcc-gold fill-jcc-gold shrink-0" />}
                  {player.approval_status === 'pending' && <Clock className="w-3 h-3 text-jcc-blue shrink-0" />}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-jcc-muted uppercase tracking-wider">
                  <Phone className="w-3 h-3" /> {player.phone}
                </div>
                
                {player.approval_status === "pending" ? (
                  <div className="flex gap-2 mt-4">
                    <button
                      disabled={isProcessing === player.id}
                      onClick={() => handleApproval(player.id, "approve")}
                      className="flex-1 py-2 rounded-lg bg-jcc-turf text-white text-[10px] font-bold hover:bg-jcc-turf-dim transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isProcessing === player.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Approve
                    </button>
                    <button
                      disabled={isProcessing === player.id}
                      onClick={() => handleApproval(player.id, "reject")}
                      className="flex-1 py-2 rounded-lg bg-jcc-bg border border-jcc-border text-jcc-red text-[10px] font-bold hover:bg-jcc-red/5 transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="px-2 py-0.5 rounded-md bg-jcc-blue/[0.06] text-jcc-blue text-[9px] font-black uppercase">
                      {player.cricket_role}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                      player.team === 'Mavericks' ? 'bg-jcc-navy text-white' : 
                      player.team === 'NeuroStrikers' ? 'bg-jcc-turf text-jcc-navy' : 
                      'bg-jcc-bg text-jcc-muted'
                    }`}>
                      {player.team}
                    </span>
                    {player.approval_status === "rejected" && (
                      <span className="px-2 py-0.5 rounded-md bg-jcc-red/10 text-jcc-red text-[9px] font-black uppercase">
                        Rejected
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => { setEditingPlayer(player); setIsAdding(false); }}
                className="p-2 rounded-lg bg-white border border-jcc-border text-jcc-muted hover:text-jcc-blue transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => handleDeactivate(player.id, player.is_active)}
                className={`p-2 rounded-lg bg-white border border-jcc-border transition-colors ${player.is_active ? 'text-jcc-muted hover:text-jcc-red' : 'text-jcc-turf'}`}
              >
                <Activity className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {editingPlayer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-jcc-navy/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-jcc-border flex items-center justify-between bg-jcc-bg/30">
                <h3 className="text-lg font-bold text-jcc-navy">
                  {isAdding ? "Add New Member" : `Edit Member: ${editingPlayer.name}`}
                </h3>
                <button onClick={() => setEditingPlayer(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X className="w-5 h-5 text-jcc-muted" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-jcc-muted uppercase tracking-widest px-1">Full Name</label>
                    <input 
                      required
                      className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                      value={editingPlayer.name || ""}
                      onChange={e => setEditingPlayer({...editingPlayer, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-jcc-muted uppercase tracking-widest px-1">Phone Number</label>
                    <input 
                      required
                      className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                      value={editingPlayer.phone || ""}
                      onChange={e => setEditingPlayer({...editingPlayer, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-jcc-muted uppercase tracking-widest px-1">Cricket Role</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                      value={editingPlayer.cricket_role || ""}
                      onChange={e => setEditingPlayer({...editingPlayer, cricket_role: e.target.value})}
                    >
                      <option value="all-rounder">All-Rounder</option>
                      <option value="batter">Batter</option>
                      <option value="bowler">Bowler</option>
                      <option value="wicketkeeper">Wicketkeeper</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-jcc-muted uppercase tracking-widest px-1">Team Assignment</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                      value={editingPlayer.team || ""}
                      onChange={e => setEditingPlayer({...editingPlayer, team: e.target.value})}
                    >
                      <option value="Unassigned">Unassigned</option>
                      <option value="Mavericks">Mavericks</option>
                      <option value="NeuroStrikers">NeuroStrikers</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-jcc-muted uppercase tracking-widest px-1">Member Tag</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                      value={editingPlayer.member_tag || ""}
                      onChange={e => setEditingPlayer({...editingPlayer, member_tag: e.target.value})}
                    >
                      <option value="member">Member</option>
                      <option value="founding-member">Founding Member</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-jcc-muted uppercase tracking-widest px-1">Group Role</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                      value={editingPlayer.group_role || ""}
                      onChange={e => setEditingPlayer({...editingPlayer, group_role: e.target.value})}
                    >
                      <option value="member">Member</option>
                      <option value="captain">Captain</option>
                      <option value="vice-captain">Vice Captain</option>
                      <option value="founding-member">Founding Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-jcc-muted uppercase tracking-widest px-1">Short Bio</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium resize-none"
                    value={editingPlayer.short_bio || ""}
                    onChange={e => setEditingPlayer({...editingPlayer, short_bio: e.target.value})}
                    placeholder="A few words about the player's journey..."
                  />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    disabled={saving}
                    type="submit"
                    className="flex-1 py-4 rounded-xl bg-jcc-navy text-white font-bold text-sm shadow-xl shadow-jcc-navy/20 hover:bg-jcc-blue transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="px-8 py-4 rounded-xl bg-jcc-bg text-jcc-muted font-bold text-sm border border-jcc-border hover:bg-white transition-all"
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
