"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  UserPlus, Search, Edit2,
  Activity, Loader2, Save, Clock,
  CheckCircle2, BarChart3, Crown, ArrowRight,
  Users as UsersIcon, ShieldCheck, UserCheck
} from "lucide-react";
import { motion } from "framer-motion";
import { getDiceBearUrl } from "@/lib/avatar";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminSkeleton from "@/components/admin/AdminSkeleton";
import AdminModal, { AdminModalDossier } from "@/components/admin/AdminModal";

interface Player {
  id: string;
  name: string;
  phone: string;
  cricket_role: string;
  team: string;
  member_tag: string;
  group_role: string;
  is_exec_committee: boolean;
  is_active: boolean;
  approval_status: string;
  image_url?: string;
  short_bio?: string;
  batting_style?: string;
  bowling_style?: string;
  created_at: string;
}

/* Team-identity dossier themes — each JCC team gets its own card
   material (FIFA Ultimate Team-style) instead of one flat surface.
   Captain badge stays gold-filled across every theme so the strongest
   status signal reads identically no matter which team it sits on. */
const TEAM_THEMES: Record<string, {
  card: string;
  name: string;
  label: string;
  value: string;
  divider: string;
  glow: string;
  badgeOutline: string;
  photoRing: string;
  action: string;
  actionHover: string;
  hair: string;
}> = {
  Mavericks: {
    card: "bg-gradient-to-br from-[#FFFDF8] to-[#F5EAD1] border-jcc-accent-dark/35",
    name: "text-jcc-blue",
    label: "text-jcc-blue/40",
    value: "text-jcc-blue/75",
    divider: "via-jcc-accent-dark/50",
    glow: "hover:shadow-[0_20px_44px_-14px_rgba(169,120,36,0.4)]",
    badgeOutline: "border-jcc-accent-dark/45 text-jcc-accent-dark",
    photoRing: "ring-jcc-accent-dark/35",
    action: "text-jcc-blue/50",
    actionHover: "group-hover:text-jcc-accent-dark",
    hair: "bg-jcc-accent-dark/25",
  },
  NeuroStrikers: {
    card: "bg-gradient-to-br from-[#0E1D38] to-[#13284A] border-jcc-accent/35",
    name: "text-jcc-navy",
    label: "text-jcc-navy/40",
    value: "text-jcc-navy/70",
    divider: "via-jcc-accent/60",
    glow: "hover:shadow-[0_20px_44px_-14px_rgba(212,175,55,0.5)]",
    badgeOutline: "border-jcc-accent/50 text-jcc-accent-highlight",
    photoRing: "ring-jcc-accent/45",
    action: "text-jcc-navy/45",
    actionHover: "group-hover:text-jcc-accent-highlight",
    hair: "bg-jcc-accent/35",
  },
  "The Outliers": {
    card: "bg-gradient-to-br from-[#0A2E24] to-[#0F3D30] border-jcc-accent-dark/30",
    name: "text-jcc-navy",
    label: "text-jcc-navy/40",
    value: "text-jcc-navy/70",
    divider: "via-jcc-accent-dark/55",
    glow: "hover:shadow-[0_20px_44px_-14px_rgba(169,120,36,0.4)]",
    badgeOutline: "border-jcc-accent-dark/45 text-jcc-accent-highlight",
    photoRing: "ring-jcc-accent-dark/40",
    action: "text-jcc-navy/45",
    actionHover: "group-hover:text-jcc-accent-highlight",
    hair: "bg-jcc-accent-dark/30",
  },
  Unassigned: {
    card: "bg-gradient-to-br from-jcc-navy to-jcc-navy-light border-jcc-blue/15",
    name: "text-jcc-blue",
    label: "text-jcc-blue/35",
    value: "text-jcc-blue/60",
    divider: "via-jcc-blue/20",
    glow: "hover:shadow-[0_20px_44px_-14px_rgba(18,35,63,0.28)]",
    badgeOutline: "border-jcc-blue/25 text-jcc-blue/55",
    photoRing: "ring-jcc-blue/10",
    action: "text-jcc-blue/40",
    actionHover: "group-hover:text-jcc-accent-dark",
    hair: "bg-jcc-blue/15",
  },
};

function getTeamTheme(team: string) {
  return TEAM_THEMES[team] || TEAM_THEMES.Unassigned;
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

  const handleExecCommitteeToggle = async (id: string, current: boolean) => {
    setIsProcessing(id);
    try {
      const response = await fetch("/api/admin/players/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({ id, updates: { is_exec_committee: !current } }),
      });
      if (!response.ok) throw new Error("Exec committee update failed");
      setPlayers(players.map(p => p.id === id ? { ...p, is_exec_committee: !current } : p));
    } catch (err) {
      console.error("Error updating exec committee:", err);
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

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const getRolePriority = (role?: string) => {
      if (role === "captain") return 1;
      if (role === "vice-captain") return 2;
      return 3;
    };
    const aPriority = getRolePriority(a.group_role);
    const bPriority = getRolePriority(b.group_role);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const captainCount = approvedPlayers.filter(p => p.group_role === "captain" || p.group_role === "vice-captain").length;

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Member Management" subtitle="Personnel & Profile Operations" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <AdminStatCard label="Active Members" value={approvedPlayers.length} sub="Approved players" icon={UsersIcon} />
        <AdminStatCard label="Pending" value={pendingPlayers.length} sub="Awaiting approval" icon={UserCheck} />
        <AdminStatCard label="Captaincy" value={captainCount} sub="Captains & vice-captains" icon={ShieldCheck} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex p-1 bg-jcc-navy-light border border-jcc-border-bright rounded-2xl shadow-inner w-full sm:w-auto">
          <button
            onClick={() => setView("all")}
            className={`flex-1 text-center px-5 py-2 rounded-xl text-[11px] font-black transition-all uppercase tracking-widest ${view === "all" ? "bg-jcc-accent text-white shadow-lg" : "text-jcc-text-muted hover:text-jcc-blue"}`}
          >
            Active ({approvedPlayers.length})
          </button>
          <button
            onClick={() => setView("pending")}
            className={`flex-1 text-center px-5 py-2 rounded-xl text-[11px] font-black transition-all relative uppercase tracking-widest ${view === "pending" ? "bg-jcc-accent text-white shadow-lg" : "text-jcc-text-muted hover:text-jcc-blue"}`}
          >
            Pending ({pendingPlayers.length})
            {pendingPlayers.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-jcc-ball-red rounded-full border-2 border-jcc-navy-light" />
            )}
          </button>
        </div>
        <button
          onClick={() => { setEditingPlayer({
            name: "", phone: "", cricket_role: "all-rounder",
            team: "Unassigned", member_tag: "member", group_role: "member",
            batting_style: "Right Hand", bowling_style: "Right Arm Pace", is_active: true
          }); setIsAdding(true); }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl btn-vibrant-blue font-black text-[12px] transition-all uppercase tracking-widest shadow-lg w-full sm:w-auto shrink-0"
        >
          <UserPlus className="w-4 h-4 shrink-0" /> Add Member
        </button>
      </div>

      <div className="admin-search-wrap">
        <Search className="admin-search-icon w-5 h-5" />
        <input
          type="text"
          placeholder="Search members, phone number, role or team..."
          className="admin-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <AdminSkeleton rows={4} rowHeight="140px" />
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {sortedPlayers.map((player, index) => {
          const isFounder = player.member_tag === "founding-member";
          const inExec = isFounder || player.is_exec_committee;
          const isCaptain = player.group_role === "captain" || player.group_role === "vice-captain";
          const roleLabel = player.cricket_role?.replace(/-/g, " ") || "—";
          const theme = getTeamTheme(player.team);
          const nameParts = player.name.trim().split(/\s+/);
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(" ");
          const isPending = player.approval_status === "pending";

          return (
            <motion.div
              layout
              key={player.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className={`group relative isolate overflow-hidden rounded-2xl border p-5 flex items-center gap-4 shadow-[0_6px_20px_-10px_rgba(18,35,63,0.25)] transition-all duration-300 ease-out hover:-translate-y-1 ${theme.card} ${theme.glow} ${!player.is_active && 'opacity-40 grayscale'}`}
            >
              {/* Foil sheen — glides across on hover, echoes .premium-card */}
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-transparent via-jcc-navy/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

              {/* Left — portrait, the visual anchor */}
              <div className="relative shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden shadow-md">
                <div className={`absolute inset-0 rounded-xl ring-2 ${theme.photoRing} pointer-events-none z-10`} />
                <img
                  src={player.image_url || getDiceBearUrl(player.name, player.team)}
                  alt={player.name}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  onError={(e) => {
                    const img = e.currentTarget;
                    const fallback = getDiceBearUrl(player.name, player.team);
                    if (img.src !== fallback) img.src = fallback;
                  }}
                />
                {isPending && (
                  <span className="absolute -top-1 -right-1 z-20 w-5 h-5 rounded-full bg-jcc-accent border-2 border-jcc-navy flex items-center justify-center">
                    <Clock className="w-2.5 h-2.5 text-jcc-seam" />
                  </span>
                )}
              </div>

              {/* Gold divider — separates portrait from the dossier column */}
              <div className={`hidden sm:block self-stretch w-px bg-gradient-to-b from-transparent to-transparent ${theme.divider}`} />

              {/* Center — dossier column */}
              <div className="flex-1 min-w-0">
                <h3 className={`font-heading leading-[1.05] ${theme.name}`}>
                  <span className="block text-sm font-semibold tracking-wide">{firstName}</span>
                  {lastName && <span className="block text-xl sm:text-2xl font-bold uppercase tracking-tight">{lastName}</span>}
                </h3>

                <div className={`mt-2.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 text-[11px] ${!lastName ? 'mt-1' : ''}`}>
                  <span className={`uppercase tracking-widest font-bold ${theme.label}`}>Team</span>
                  <span className={`font-semibold truncate ${theme.value}`}>{player.team || "Unassigned"}</span>
                  <span className={`uppercase tracking-widest font-bold ${theme.label}`}>Role</span>
                  <span className={`font-semibold capitalize truncate ${theme.value}`}>{roleLabel}</span>
                  <span className={`uppercase tracking-widest font-bold ${theme.label}`}>Phone</span>
                  <span className={`font-semibold truncate ${theme.value}`}>{player.phone}</span>
                </div>

                {(isCaptain || isFounder || inExec || player.approval_status === "rejected") && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {isCaptain && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-jcc-accent text-jcc-seam text-[10px] font-black uppercase tracking-wider shadow-[0_2px_8px_-2px_rgba(212,175,55,0.6)]">
                        <Crown className="w-3 h-3" />
                        {player.group_role === "vice-captain" ? "Vice Captain" : "Captain"}
                      </span>
                    )}
                    {isFounder && (
                      <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${theme.badgeOutline}`}>
                        Founding Member
                      </span>
                    )}
                    {inExec && (
                      <button
                        disabled={isFounder || isProcessing === player.id}
                        onClick={() => handleExecCommitteeToggle(player.id, player.is_exec_committee)}
                        title={isFounder ? "Founding members are always on the executive committee" : "Remove from Executive Committee"}
                        className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors ${theme.badgeOutline} ${isFounder ? "cursor-not-allowed" : "hover:bg-jcc-accent/10 cursor-pointer"}`}
                      >
                        Executive Committee
                      </button>
                    )}
                    {player.approval_status === "rejected" && (
                      <span className="px-2.5 py-1 rounded-full border border-jcc-danger/40 text-jcc-danger text-[10px] font-bold uppercase tracking-wider">
                        Rejected
                      </span>
                    )}
                  </div>
                )}

                {isPending ? (
                  <div className="flex gap-2 mt-3">
                    <button
                      disabled={isProcessing === player.id}
                      onClick={() => handleApproval(player.id, "approve")}
                      className="flex-1 py-2 rounded-lg bg-jcc-accent text-jcc-seam text-[10px] font-bold uppercase tracking-wider hover:bg-jcc-accent-highlight transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isProcessing === player.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      disabled={isProcessing === player.id}
                      onClick={() => handleApproval(player.id, "reject")}
                      className="flex-1 py-2 rounded-lg border border-jcc-danger/40 text-jcc-danger text-[10px] font-bold uppercase tracking-wider hover:bg-jcc-danger hover:text-jcc-navy transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  /* Manage Player — expands into contextual actions on hover */
                  <div className="relative h-7 mt-3 -ml-0.5">
                    <div className={`absolute inset-y-0 left-0 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity duration-300 group-hover:opacity-0 ${theme.action}`}>
                      Manage Player <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                    <div className="absolute inset-y-0 left-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        title="Edit"
                        onClick={() => { setEditingPlayer(player); setIsAdding(false); }}
                        className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${theme.action} ${theme.actionHover} transition-colors`}
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <span className={`w-px h-3 ${theme.hair}`} />
                      <a
                        title="Statistics"
                        href={`/members/${player.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${theme.action} ${theme.actionHover} transition-colors`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" /> Stats
                      </a>
                      <span className={`w-px h-3 ${theme.hair}`} />
                      <button
                        title={player.is_active ? "Deactivate" : "Activate"}
                        onClick={() => handleDeactivate(player.id, player.is_active)}
                        className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${player.is_active ? `${theme.action} hover:text-jcc-danger` : "text-jcc-accent"}`}
                      >
                        <Activity className="w-3.5 h-3.5" /> {player.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      <AdminModal isOpen={!!editingPlayer} onClose={() => setEditingPlayer(null)} maxWidth="max-w-2xl">
        {editingPlayer && (
          isAdding ? (
            <div className="p-8 border-b border-jcc-border-bright bg-jcc-navy-light/60 shrink-0">
              <h3 className="text-xl font-black text-jcc-blue uppercase tracking-tight">Register Personnel</h3>
            </div>
          ) : (
            <AdminModalDossier
              name={editingPlayer.name || ""}
              photoUrl={editingPlayer.image_url}
              team={editingPlayer.team}
              onClose={() => setEditingPlayer(null)}
              badges={
                <>
                  {editingPlayer.team && (
                    <span className="px-2.5 py-1 rounded-full border border-jcc-border-bright text-jcc-accent-dark text-[10px] font-bold uppercase tracking-wider">
                      {editingPlayer.team}
                    </span>
                  )}
                  {editingPlayer.group_role && editingPlayer.group_role !== "member" && (
                    <span className="px-2.5 py-1 rounded-full bg-jcc-accent/15 text-jcc-accent-dark text-[10px] font-bold uppercase tracking-wider">
                      {editingPlayer.group_role.replace(/-/g, " ")}
                    </span>
                  )}
                </>
              }
            />
          )
        )}
        {editingPlayer && (
          <div className="overflow-y-auto">
                  <form onSubmit={handleSave} className="p-8 sm:p-10 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="admin-label">Full Identity</label>
                        <input
                          required
                          className="admin-input"
                          value={editingPlayer?.name || ""}
                          onChange={e => setEditingPlayer(prev => prev ? {...prev, name: e.target.value} : null)}
                        />
                      </div>
                      <div>
                        <label className="admin-label">Contact Link</label>
                        <input
                          required
                          className="admin-input"
                          value={editingPlayer?.phone || ""}
                          onChange={e => setEditingPlayer(prev => prev ? {...prev, phone: e.target.value} : null)}
                        />
                      </div>
                      <div>
                        <label className="admin-label">Specialization</label>
                        <select
                          className="admin-select"
                          value={editingPlayer?.cricket_role || ""}
                          onChange={e => setEditingPlayer(prev => prev ? {...prev, cricket_role: e.target.value} : null)}
                        >
                          <option value="all-rounder">All-Rounder</option>
                          <option value="batter">Batter</option>
                          <option value="bowler">Bowler</option>
                          <option value="wicketkeeper">Wicketkeeper</option>
                        </select>
                      </div>
                      <div>
                        <label className="admin-label">Tactical Deployment</label>
                        <select
                          className="admin-select"
                          value={editingPlayer?.team || ""}
                          onChange={e => setEditingPlayer(prev => prev ? {...prev, team: e.target.value} : null)}
                        >
                          <option value="Unassigned">Unassigned</option>
                          <option value="Mavericks">Mavericks</option>
                          <option value="NeuroStrikers">NeuroStrikers</option>
                          <option value="The Outliers">The Outliers</option>
                        </select>
                      </div>
                      <div>
                        <label className="admin-label">Service Tag</label>
                        <select
                          className="admin-select"
                          value={editingPlayer?.member_tag || ""}
                          onChange={e => setEditingPlayer(prev => prev ? {...prev, member_tag: e.target.value} : null)}
                        >
                          <option value="member">Member</option>
                          <option value="founding-member">Founding Member</option>
                        </select>
                      </div>
                      <div>
                        <label className="admin-label">Command Authority</label>
                        <select
                          className="admin-select"
                          value={editingPlayer?.group_role || ""}
                          onChange={e => setEditingPlayer(prev => prev ? {...prev, group_role: e.target.value} : null)}
                        >
                          <option value="member">Member</option>
                          <option value="captain">Captain</option>
                          <option value="vice-captain">Vice Captain</option>
                          <option value="founding-member">Founding Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="admin-label">Personnel Dossier</label>
                      <textarea
                        rows={3}
                        className="admin-textarea"
                        value={editingPlayer?.short_bio || ""}
                        onChange={e => setEditingPlayer(prev => prev ? {...prev, short_bio: e.target.value} : null)}
                        placeholder="Write achievements, notes, or availability..."
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 pt-6">
                      <button
                        disabled={saving}
                        type="submit"
                        className="w-full sm:flex-1 py-5 rounded-2xl btn-vibrant-blue font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest shadow-xl"
                      >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Save Identity
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPlayer(null)}
                        className="admin-btn-secondary w-full sm:w-auto"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
