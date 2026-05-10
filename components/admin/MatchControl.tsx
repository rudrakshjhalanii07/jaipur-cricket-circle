"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Calendar, Clock, MapPin, Users, Save, Lock, Unlock, Loader2, 
  CheckCircle2, AlertCircle, Edit3, Trash2, PlusCircle, X, ChevronRight,
  ExternalLink, History, Timer, Map, Trophy, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ConfirmDialog from "./ConfirmDialog";
import PastVenuesModal from "./PastVenuesModal";

export default function MatchControl({ adminPassword }: { adminPassword?: string }) {
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  
  // UX States
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [showVenues, setShowVenues] = useState(false);
  
  // New UI states
  const [regCounts, setRegCounts] = useState({ confirmed: 0, waitlist: 0 });
  const [timeLeft, setTimeLeft] = useState("");
  
  // Dialog States
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: "primary" | "danger" | "success";
    confirmText?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "primary"
  });

  useEffect(() => {
    fetchMatch();
  }, []);

  useEffect(() => {
    if (match) {
      updateCountdown(); // Run immediately
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [match]);

  const updateCountdown = () => {
    if (!match?.match_date) {
      setTimeLeft("Scheduling...");
      return;
    }
    
    try {
      const dateStr = match.match_date; // Expected YYYY-MM-DD
      const timeStr = match.match_time || "07:00 AM";
      
      // Manual parse to avoid browser date parsing inconsistencies
      const matchDate = new Date(dateStr);
      
      // Parse "07:00 AM" or "19:00"
      const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1]);
        const minutes = parseInt(timeParts[2]);
        const modifier = timeParts[3]?.toUpperCase();

        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        
        matchDate.setHours(hours, minutes, 0, 0);
      } else {
        matchDate.setHours(7, 0, 0, 0); // Fallback
      }

      const now = new Date();
      const diff = matchDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Match in progress");
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (d > 0) {
        setTimeLeft(`Starts in ${d}d ${h}h ${m}m`);
      } else {
        setTimeLeft(`Starts in ${h}h ${m}m ${s}s`);
      }
    } catch (err) {
      console.error("Countdown error:", err);
      setTimeLeft("Date Error");
    }
  };

  const fetchMatch = async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("match_date", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setMatch(data || null);

      if (data) {
        // Fetch registration counts
        const { data: regs } = await supabase
          .from("registrations")
          .select("status")
          .eq("match_id", data.id);
        
        if (regs) {
          const confirmed = regs.filter(r => r.status === 'confirmed').length;
          const waitlist = regs.filter(r => r.status === 'waitlist').length;
          setRegCounts({ confirmed, waitlist });
        }
      }
    } catch (err) {
      console.error("Error fetching match:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    setStatus("idle");
    try {
      const response = await fetch("/api/admin/matches/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({
          match_id: match.id,
          updates: {
            match_date: editData.match_date,
            match_time: editData.match_time,
            location_name: editData.location_name,
            location_map_url: editData.location_map_url,
            player_limit: parseInt(editData.player_limit),
            status: editData.status
          }
        }),
      });

      if (!response.ok) throw new Error("Update failed");

      const result = await response.json();
      setMatch(result.match);
      setIsEditing(false);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/matches/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify(editData),
      });

      if (!response.ok) throw new Error("Creation failed");

      const result = await response.json();
      setMatch(result.match);
      setIsCreating(false);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/matches/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({ match_id: match.id }),
      });

      if (response.ok) {
        setMatch(null);
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!match?.id) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/matches/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({
          match_id: match.id,
          updates: { status: newStatus },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setMatch(result.match);
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setEditData({ ...match });
    setIsEditing(true);
  };

  const startCreating = () => {
    setEditData({
      match_date: new Date().toISOString().split('T')[0],
      match_time: "07:00 AM",
      location_name: "",
      location_map_url: "",
      player_limit: 18,
      status: "open"
    });
    setIsCreating(true);
  };

  const openConfirm = (config: Omit<typeof confirmConfig, "isOpen">) => {
    setConfirmConfig({ ...config, isOpen: true });
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-jcc-accent opacity-20" /></div>;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white font-[var(--font-heading)] uppercase tracking-tight">Match Control</h2>
          <p className="text-[13px] text-white/50 font-medium uppercase tracking-widest mt-1">Logistics & Registration Lifecycle</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!match || match.status === "unscheduled" ? (
          <motion.div 
            key="unscheduled"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-12 rounded-[32px] bg-jcc-accent/5 border border-jcc-accent/10 text-center space-y-8"
          >
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto shadow-inner">
              <Calendar className="w-10 h-10 text-jcc-accent" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">No Match Scheduled</h3>
              <p className="text-[14px] text-white/40 font-medium max-w-md mx-auto leading-relaxed uppercase tracking-widest">
                The circle is currently quiet. Schedule a game to open registrations.
              </p>
            </div>
            {!isCreating ? (
              <button
                onClick={startCreating}
                className="px-12 py-5 rounded-2xl btn-vibrant-blue text-black font-black text-sm transition-all flex items-center justify-center gap-2 mx-auto uppercase tracking-widest"
              >
                <PlusCircle className="w-5 h-5" />
                Schedule New Match
              </button>
            ) : (
              <form onSubmit={handleCreate} className="text-left max-w-2xl mx-auto premium-card p-8 sm:p-10 space-y-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-black text-white uppercase tracking-tight">New Match Details</h4>
                  <button type="button" onClick={() => setIsCreating(false)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                    <X className="w-5 h-5 text-white/30" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Match Date</label>
                     <input required type="date" className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none text-white text-[15px] font-black shadow-inner" 
                       value={editData.match_date} onChange={e => setEditData({...editData, match_date: e.target.value})} />
                   </div>
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Match Time</label>
                     <input required type="text" className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none text-white text-[15px] font-black shadow-inner" 
                       value={editData.match_time} onChange={e => setEditData({...editData, match_time: e.target.value})} />
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Venue Details</label>
                    <button type="button" onClick={() => setShowVenues(true)} className="text-[10px] font-black text-jcc-accent hover:underline flex items-center gap-1 uppercase tracking-widest">
                      <History className="w-3.5 h-3.5" /> Past Venues
                    </button>
                  </div>
                  <input required type="text" placeholder="Venue Name" className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none text-white text-[15px] font-black shadow-inner placeholder:text-white/10" 
                    value={editData.location_name} onChange={e => setEditData({...editData, location_name: e.target.value})} />
                  <input type="text" placeholder="Google Maps URL" className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none text-white text-[15px] font-black shadow-inner placeholder:text-white/10" 
                    value={editData.location_map_url} onChange={e => setEditData({...editData, location_map_url: e.target.value})} />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-6">
                  <button disabled={saving} type="submit" className="w-full sm:flex-1 py-5 rounded-2xl btn-vibrant-turf text-black font-black text-sm flex items-center justify-center gap-2 uppercase tracking-widest">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Confirm & Schedule
                  </button>
                  <button type="button" onClick={() => setIsCreating(false)} className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-black text-sm hover:text-white transition-all uppercase tracking-widest">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        ) : match.status === "cancelled" ? (
          <motion.div 
            key="cancelled"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-12 rounded-[32px] bg-jcc-ball-red/5 border border-jcc-ball-red/10 text-center space-y-8"
          >
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle className="w-10 h-10 text-jcc-ball-red" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-jcc-ball-red uppercase tracking-tight">Match Cancelled</h3>
              <p className="text-[14px] text-white/40 font-medium max-w-md mx-auto leading-relaxed uppercase tracking-widest">
                Existing registration data is preserved. You can resume this match or delete it permanently.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => openConfirm({
                  title: "Resume Match?",
                  description: "This will re-open registration. Preserved data will be active.",
                  variant: "success",
                  confirmText: "Resume Now",
                  onConfirm: () => handleStatusChange("open")
                })}
                disabled={saving}
                className="w-full sm:w-auto px-12 py-5 rounded-2xl btn-vibrant-turf text-black font-black text-sm flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Unlock className="w-5 h-5" />
                Resume Match
              </button>
              <button
                onClick={() => openConfirm({
                  title: "Delete Permanently?",
                  description: "DANGER: This will permanently delete this match and all linked registrations. This cannot be undone.",
                  variant: "danger",
                  confirmText: "Delete Forever",
                  onConfirm: handleDelete
                })}
                disabled={saving}
                className="w-full sm:w-auto px-12 py-5 rounded-2xl bg-white/5 border border-jcc-ball-red/20 text-jcc-ball-red font-black text-sm hover:bg-jcc-ball-red/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Trash2 className="w-5 h-5" />
                Delete Permanently
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {isEditing ? (
              <div className="premium-card p-8 sm:p-10">
                 <form onSubmit={handleUpdate} className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">Edit Match Details</h3>
                      <button type="button" onClick={() => setIsEditing(false)} className="p-2 rounded-xl hover:bg-white/5">
                        <X className="w-6 h-6 text-white/20" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Match Date</label>
                        <input type="date" className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none text-white text-[15px] font-black shadow-inner" 
                          value={editData.match_date} onChange={e => setEditData({...editData, match_date: e.target.value})} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Match Time</label>
                        <input type="text" className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none text-white text-[15px] font-black shadow-inner" 
                          value={editData.match_time} onChange={e => setEditData({...editData, match_time: e.target.value})} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Venue Name</label>
                        <input type="text" className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none text-white text-[15px] font-black shadow-inner" 
                          value={editData.location_name} onChange={e => setEditData({...editData, location_name: e.target.value})} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Player Limit</label>
                        <input type="number" className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none text-white text-[15px] font-black shadow-inner" 
                          value={editData.player_limit} onChange={e => setEditData({...editData, player_limit: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Maps URL</label>
                      <input type="text" className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none text-white text-[15px] font-black shadow-inner" 
                        value={editData.location_map_url} onChange={e => setEditData({...editData, location_map_url: e.target.value})} />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button disabled={saving} type="submit" className="w-full sm:flex-1 py-5 rounded-2xl btn-vibrant-blue text-black font-black text-sm transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Save Changes
                      </button>
                      <button type="button" onClick={() => setIsEditing(false)} className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-black text-sm hover:text-white transition-all uppercase tracking-widest">
                        Cancel Edit
                      </button>
                    </div>
                  </form>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT: Upcoming Match Hero Card */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="premium-card pitch-lines relative p-8 sm:p-12 min-h-[450px] flex flex-col justify-between overflow-hidden group border-white/20">
                    {/* Animated Stadium Glow */}
                    <div className="absolute inset-0 bg-radial-gradient from-jcc-accent/5 to-transparent opacity-40 z-0 pointer-events-none" />
                    
                    <div className="relative z-10 space-y-10">
                      {/* Badge */}
                      <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-jcc-accent/10 border border-jcc-accent/20 text-jcc-accent font-black text-[10px] uppercase tracking-widest">
                        <Trophy className="w-4 h-4" />
                        {new Date(match.match_date).getDay() === 0 ? "Sunday Match Day" : "Match Day Scheduled"}
                      </div>

                      {/* Main Info */}
                      <div>
                        <h3 className="text-5xl sm:text-7xl font-black text-white tracking-tighter mb-4 font-[var(--font-heading)] uppercase">
                          {new Date(match.match_date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                        </h3>
                        <div className="flex flex-wrap items-center gap-6">
                           <div className="flex items-center gap-3 text-jcc-accent font-black text-[15px] uppercase tracking-widest">
                            <Timer className="w-5 h-5 animate-pulse" />
                            {timeLeft}
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                          <div className="flex items-center gap-3 text-white/60 font-black text-[15px] uppercase tracking-widest">
                            <Clock className="w-5 h-5" />
                            {match.match_time}
                          </div>
                        </div>
                      </div>

                      {/* Venue */}
                      <div className="flex items-start gap-5 p-6 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-xl max-w-md group-hover:border-jcc-accent/20 transition-all shadow-inner">
                        <div className="w-14 h-14 rounded-2xl bg-black/40 flex items-center justify-center text-jcc-accent shadow-xl border border-white/5">
                          <MapPin className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-2">Battleground</p>
                          <p className="text-lg font-black text-white leading-tight uppercase tracking-tight">{match.location_name}</p>
                          {match.location_map_url && (
                            <a href={match.location_map_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-jcc-accent flex items-center gap-2 mt-3 hover:underline uppercase tracking-widest">
                              View Orientation <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Registration Status Badge */}
                    <div className="absolute top-10 right-10">
                       <span className={`px-5 py-2 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl border ${
                          match.status === "open" 
                            ? "bg-emerald-400 text-black border-emerald-500" 
                            : "bg-jcc-gold text-black border-jcc-gold/50"
                        }`}>
                          {match.status}
                        </span>
                    </div>

                    {/* Player Slots Progress */}
                    <div className="relative z-10 mt-12 space-y-5">
                      <div className="flex items-end justify-between px-1">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em]">Squad Strength</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-white font-[var(--font-heading)]">{regCounts.confirmed}</span>
                            <span className="text-sm font-black text-white/30 uppercase tracking-widest">/ {match.player_limit} Warriors</span>
                          </div>
                        </div>
                        {regCounts.waitlist > 0 && (
                          <div className="px-4 py-2 rounded-xl bg-jcc-gold/10 border border-jcc-gold/20 text-jcc-gold font-black text-[11px] flex items-center gap-2 uppercase tracking-widest shadow-lg">
                            <Users className="w-4 h-4" />
                            {regCounts.waitlist} Waitlist
                          </div>
                        )}
                      </div>
                      
                      <div className="h-5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 p-1.5 shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((regCounts.confirmed / match.player_limit) * 100, 100)}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            regCounts.confirmed >= match.player_limit ? 'bg-jcc-gold' : 'bg-jcc-accent'
                          } shadow-[0_0_20px_rgba(0,194,255,0.4)]`}
                        />
                      </div>
                      <p className="text-[11px] text-white/40 font-black px-1 italic uppercase tracking-widest">
                        {regCounts.confirmed >= match.player_limit 
                          ? "Squad limit reached. New entries added to waitlist." 
                          : `${match.player_limit - regCounts.confirmed} spots remaining for the Sunday showdown.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Quick Actions Panel */}
                <div className="space-y-6">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] px-3">Command Panel</p>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={startEditing}
                      className="w-full flex items-center gap-5 p-5 rounded-3xl premium-card hover:border-jcc-accent/30 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-jcc-accent group-hover:bg-jcc-accent group-hover:text-black transition-all shadow-inner border border-white/5">
                        <Edit3 className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-[15px] font-black text-white uppercase tracking-tight">Edit Match</p>
                        <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest mt-1">Logistics & Venue</p>
                      </div>
                      <ChevronRight className="w-5 h-5 ml-auto text-white/10 group-hover:text-jcc-accent group-hover:translate-x-1 transition-all" />
                    </button>

                    <button
                      onClick={() => handleStatusChange(match.status === 'open' ? 'closed' : 'open')}
                      className="w-full flex items-center gap-5 p-5 rounded-3xl premium-card hover:border-emerald-400/30 transition-all group"
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-inner border border-white/5 ${
                        match.status === 'open' ? 'bg-jcc-gold/10 text-jcc-gold group-hover:bg-jcc-gold group-hover:text-black' : 'bg-emerald-400/10 text-emerald-400 group-hover:bg-emerald-400 group-hover:text-black'
                      }`}>
                        {match.status === 'open' ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                      </div>
                      <div className="text-left">
                        <p className="text-[15px] font-black text-white uppercase tracking-tight">{match.status === 'open' ? 'Close Reg' : 'Open Reg'}</p>
                        <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest mt-1">Lifecycle State</p>
                      </div>
                      <ChevronRight className="w-5 h-5 ml-auto text-white/10 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                    </button>

                    <button
                      onClick={() => openConfirm({
                        title: "Unschedule & Delete Match?",
                        description: "DANGER: This will permanently delete the current match record and WIPE ALL registrations. This cannot be undone.",
                        variant: "danger",
                        confirmText: "Delete Match",
                        onConfirm: handleDelete
                      })}
                      className="w-full flex items-center gap-5 p-5 rounded-3xl premium-card hover:border-white/30 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-white group-hover:text-black transition-all shadow-inner border border-white/5">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-[15px] font-black text-white uppercase tracking-tight">Unschedule</p>
                        <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest mt-1">Remove from Portal</p>
                      </div>
                      <ChevronRight className="w-5 h-5 ml-auto text-white/10 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </button>

                    <button
                      onClick={() => openConfirm({
                        title: "Cancel Match?",
                        description: "Are you sure? Registrations will be preserved, but registration will be disabled.",
                        variant: "danger",
                        onConfirm: () => handleStatusChange("cancelled")
                      })}
                      className="w-full flex items-center gap-5 p-5 rounded-3xl premium-card hover:border-jcc-ball-red/30 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-jcc-ball-red/10 flex items-center justify-center text-jcc-ball-red group-hover:bg-jcc-ball-red group-hover:text-black transition-all shadow-inner border border-white/5">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-[15px] font-black text-jcc-ball-red uppercase tracking-tight">Cancel Match</p>
                        <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest mt-1">Emergency Reset</p>
                      </div>
                      <ChevronRight className="w-5 h-5 ml-auto text-white/10 group-hover:text-jcc-ball-red group-hover:translate-x-1 transition-all" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Status Feedback */}
            <AnimatePresence>
              {status === "success" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-3 text-emerald-400 text-sm font-black uppercase tracking-widest bg-emerald-400/5 p-4 rounded-2xl border border-emerald-400/10">
                  <CheckCircle2 className="w-5 h-5" /> Operation Confirmed
                </motion.div>
              )}
              {status === "error" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-3 text-jcc-ball-red text-sm font-black uppercase tracking-widest bg-jcc-ball-red/5 p-4 rounded-2xl border border-jcc-ball-red/10">
                  <AlertCircle className="w-5 h-5" /> System Error Detected
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        description={confirmConfig.description}
        variant={confirmConfig.variant}
        confirmText={confirmConfig.confirmText}
      />

      <PastVenuesModal 
        isOpen={showVenues}
        onClose={() => setShowVenues(false)}
        onSelect={(venue) => setEditData({ ...editData, location_name: venue.name, location_map_url: venue.url })}
      />
    </div>
  );
}
