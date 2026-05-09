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

  if (loading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-jcc-blue opacity-20" /></div>;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-jcc-navy font-[var(--font-heading)]">Match Control</h2>
          <p className="text-[12px] text-jcc-muted font-medium">Manage match logistics and registration lifecycle.</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!match || match.status === "unscheduled" ? (
          <motion.div 
            key="unscheduled"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-10 rounded-[32px] bg-jcc-blue/[0.04] border border-jcc-blue/10 text-center space-y-6"
          >
            <div className="w-20 h-20 rounded-3xl bg-white border border-jcc-blue/10 flex items-center justify-center mx-auto shadow-sm">
              <Calendar className="w-10 h-10 text-jcc-blue" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-jcc-navy">No Match Scheduled</h3>
              <p className="text-sm text-jcc-muted font-medium max-w-md mx-auto">
                Registration page will show "Stay Tuned" until a new match is scheduled.
              </p>
            </div>
            {!isCreating ? (
              <button
                onClick={startCreating}
                className="px-10 py-4 rounded-2xl bg-jcc-blue-deep text-white font-bold text-sm shadow-xl shadow-jcc-blue/20 hover:bg-jcc-blue transition-all flex items-center justify-center gap-2 mx-auto"
              >
                <PlusCircle className="w-4 h-4" />
                Schedule New Match
              </button>
            ) : (
              <form onSubmit={handleCreate} className="text-left max-w-2xl mx-auto glass-card p-8 space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-jcc-navy">New Match Details</h4>
                  <button type="button" onClick={() => setIsCreating(false)} className="p-2 rounded-lg hover:bg-jcc-bg transition-colors">
                    <X className="w-4 h-4 text-jcc-muted" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest px-1">Match Date</label>
                     <input required type="date" className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none text-sm font-medium" 
                       value={editData.match_date} onChange={e => setEditData({...editData, match_date: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest px-1">Match Time</label>
                     <input required type="text" className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none text-sm font-medium" 
                       value={editData.match_time} onChange={e => setEditData({...editData, match_time: e.target.value})} />
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest px-1">Venue Details</label>
                    <button type="button" onClick={() => setShowVenues(true)} className="text-[10px] font-bold text-jcc-blue hover:underline flex items-center gap-1">
                      <History className="w-3 h-3" /> Past Venues
                    </button>
                  </div>
                  <input required type="text" placeholder="Venue Name" className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none text-sm font-medium" 
                    value={editData.location_name} onChange={e => setEditData({...editData, location_name: e.target.value})} />
                  <input type="text" placeholder="Google Maps URL" className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none text-sm font-medium" 
                    value={editData.location_map_url} onChange={e => setEditData({...editData, location_map_url: e.target.value})} />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button disabled={saving} type="submit" className="flex-1 py-4 rounded-2xl bg-jcc-turf text-jcc-navy font-bold text-sm shadow-xl shadow-jcc-turf/20 hover:bg-jcc-turf-dim transition-all flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm & Schedule
                  </button>
                  <button type="button" onClick={() => setIsCreating(false)} className="px-6 py-4 rounded-2xl bg-white border border-jcc-border text-jcc-muted font-bold text-sm hover:text-jcc-navy transition-all">
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
            className="p-10 rounded-[32px] bg-jcc-red/[0.04] border border-jcc-red/10 text-center space-y-6"
          >
            <div className="w-20 h-20 rounded-3xl bg-white border border-jcc-red/10 flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle className="w-10 h-10 text-jcc-red" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-jcc-red">Match Cancelled</h3>
              <p className="text-sm text-jcc-muted font-medium max-w-md mx-auto">
                Existing registration data is preserved. You can resume this match or delete it permanently.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => openConfirm({
                  title: "Resume Match?",
                  description: "This will re-open registration. Preserved data will be active.",
                  variant: "success",
                  confirmText: "Resume Now",
                  onConfirm: () => handleStatusChange("open")
                })}
                disabled={saving}
                className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-jcc-turf text-jcc-navy font-bold text-sm shadow-xl shadow-jcc-turf/20 hover:bg-jcc-turf-dim transition-all flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
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
                className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-white border border-jcc-red/20 text-jcc-red font-bold text-sm hover:bg-jcc-red/[0.02] transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Permanently
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {isEditing ? (
              <div className="glass-card p-8">
                 <form onSubmit={handleUpdate} className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-jcc-navy">Edit Match Details</h3>
                      <button type="button" onClick={() => setIsEditing(false)} className="p-2 rounded-lg hover:bg-jcc-bg">
                        <X className="w-5 h-5 text-jcc-muted" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest px-1">Match Date</label>
                        <input type="date" className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none text-sm font-medium" 
                          value={editData.match_date} onChange={e => setEditData({...editData, match_date: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest px-1">Match Time</label>
                        <input type="text" className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none text-sm font-medium" 
                          value={editData.match_time} onChange={e => setEditData({...editData, match_time: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest px-1">Venue Name</label>
                        <input type="text" className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none text-sm font-medium" 
                          value={editData.location_name} onChange={e => setEditData({...editData, location_name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest px-1">Player Limit</label>
                        <input type="number" className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none text-sm font-medium" 
                          value={editData.player_limit} onChange={e => setEditData({...editData, player_limit: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest px-1">Maps URL</label>
                      <input type="text" className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none text-sm font-medium" 
                        value={editData.location_map_url} onChange={e => setEditData({...editData, location_map_url: e.target.value})} />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button disabled={saving} type="submit" className="flex-1 py-3.5 rounded-xl bg-jcc-blue-deep text-white font-bold text-sm hover:bg-jcc-blue transition-all flex items-center justify-center gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                      </button>
                      <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3.5 rounded-xl bg-white border border-jcc-border text-jcc-muted font-bold text-sm hover:text-jcc-navy transition-all">
                        Cancel Edit
                      </button>
                    </div>
                  </form>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT: Upcoming Match Hero Card */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="scoreboard-card pitch-lines relative p-8 sm:p-12 min-h-[400px] flex flex-col justify-between overflow-hidden group">
                    {/* Animated Stadium Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-radial-gradient from-jcc-blue/10 to-transparent opacity-50 animate-pulse-glow pointer-events-none" />
                    
                    {/* Floating Cricket Ball Animation */}
                    <motion.div 
                      animate={{ rotate: 360, y: [0, -10, 0] }}
                      transition={{ rotate: { duration: 10, repeat: Infinity, ease: "linear" }, y: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
                      className="absolute top-10 right-10 w-20 h-20 opacity-20 pointer-events-none hidden sm:block"
                    >
                      <svg viewBox="0 0 100 100" className="w-full h-full text-jcc-navy">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" />
                        <path d="M15,50 Q50,40 85,50" fill="none" stroke="currentColor" strokeWidth="2" />
                        <path d="M15,50 Q50,60 85,50" fill="none" stroke="currentColor" strokeWidth="2" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
                      </svg>
                    </motion.div>

                    <div className="relative z-10 space-y-8">
                      {/* Badge */}
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-jcc-blue/[0.08] border border-jcc-blue/20 text-jcc-blue-deep font-bold text-[11px] uppercase tracking-wider">
                        <Trophy className="w-3.5 h-3.5" />
                        {new Date(match.match_date).getDay() === 0 ? "Sunday Match Scheduled" : "Upcoming Match Scheduled"}
                      </div>

                      {/* Main Info */}
                      <div>
                        <h3 className="text-4xl sm:text-6xl font-black text-jcc-navy tracking-tight mb-2 font-[var(--font-heading)]">
                          {new Date(match.match_date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                           <div className="flex items-center gap-2 text-jcc-blue-deep font-bold text-sm sm:text-base">
                            <Timer className="w-4 h-4 sm:w-5 h-5 animate-pulse" />
                            {timeLeft}
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-jcc-border" />
                          <div className="flex items-center gap-2 text-jcc-muted font-bold text-sm sm:text-base">
                            <Clock className="w-4 h-4 sm:w-5 h-5" />
                            {match.match_time}
                          </div>
                        </div>
                      </div>

                      {/* Venue */}
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/40 border border-jcc-border/50 backdrop-blur-sm max-w-md group-hover:border-jcc-blue/30 transition-all">
                        <div className="w-12 h-12 rounded-xl bg-jcc-bg flex items-center justify-center text-jcc-blue shadow-sm">
                          <MapPin className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest mb-1">Venue Location</p>
                          <p className="text-base font-bold text-jcc-navy leading-tight">{match.location_name}</p>
                          {match.location_map_url && (
                            <a href={match.location_map_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-jcc-blue flex items-center gap-1 mt-2 hover:underline">
                              View on Maps <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Registration Status Badge */}
                    <div className="absolute top-8 right-8 flex flex-col items-end gap-2">
                       <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-sm border ${
                          match.status === "open" 
                            ? "bg-jcc-turf text-white border-jcc-turf-dim" 
                            : "bg-jcc-gold text-white border-jcc-gold/50"
                        }`}>
                          {match.status}
                        </span>
                    </div>

                    {/* Player Slots Progress */}
                    <div className="relative z-10 mt-12 space-y-4">
                      <div className="flex items-end justify-between px-1">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-jcc-muted uppercase tracking-[0.2em]">Squad Strength</p>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-jcc-navy">{regCounts.confirmed}</span>
                            <span className="text-sm font-bold text-jcc-muted">/ {match.player_limit} Players</span>
                          </div>
                        </div>
                        {regCounts.waitlist > 0 && (
                          <div className="px-3 py-1.5 rounded-lg bg-jcc-gold/[0.08] border border-jcc-gold/20 text-jcc-gold-deep font-bold text-[11px] flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {regCounts.waitlist} on Waitlist
                          </div>
                        )}
                      </div>
                      
                      <div className="h-4 w-full bg-jcc-bg rounded-full overflow-hidden border border-jcc-border p-1">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((regCounts.confirmed / match.player_limit) * 100, 100)}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            regCounts.confirmed >= match.player_limit ? 'bg-jcc-gold' : 'bg-jcc-turf'
                          } shadow-[0_0_12px_rgba(63,163,77,0.3)]`}
                        />
                      </div>
                      <p className="text-[11px] text-jcc-muted font-bold px-1 italic">
                        {regCounts.confirmed >= match.player_limit 
                          ? "Registration full. Joining now will put you on waitlist." 
                          : `${match.player_limit - regCounts.confirmed} slots remaining for the Sunday showdown.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Quick Actions Panel */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-jcc-muted uppercase tracking-[0.2em] px-2">Quick Actions</p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={startEditing}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-jcc-border hover:border-jcc-blue hover:shadow-lg hover:shadow-jcc-blue/5 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-jcc-bg flex items-center justify-center text-jcc-blue group-hover:bg-jcc-blue group-hover:text-white transition-colors">
                        <Edit3 className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-jcc-navy">Edit Match</p>
                        <p className="text-[10px] text-jcc-muted font-medium">Update date, time or venue</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto text-jcc-border group-hover:text-jcc-blue" />
                    </button>

                    <button
                      onClick={() => handleStatusChange(match.status === 'open' ? 'closed' : 'open')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-jcc-border hover:border-jcc-turf hover:shadow-lg hover:shadow-jcc-turf/5 transition-all group"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        match.status === 'open' ? 'bg-jcc-gold/[0.08] text-jcc-gold group-hover:bg-jcc-gold group-hover:text-white' : 'bg-jcc-turf/[0.08] text-jcc-turf group-hover:bg-jcc-turf group-hover:text-white'
                      }`}>
                        {match.status === 'open' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-jcc-navy">{match.status === 'open' ? 'Close Registration' : 'Open Registration'}</p>
                        <p className="text-[10px] text-jcc-muted font-medium">{match.status === 'open' ? 'Stop taking new entries' : 'Enable player registration'}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto text-jcc-border group-hover:text-jcc-turf" />
                    </button>

                    <button
                      onClick={() => openConfirm({
                        title: "Unschedule & Delete Match?",
                        description: "DANGER: This will permanently delete the current match record and WIPE ALL registrations. This cannot be undone.",
                        variant: "danger",
                        confirmText: "Delete Match",
                        onConfirm: handleDelete
                      })}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-jcc-border hover:border-jcc-navy hover:shadow-lg hover:shadow-jcc-navy/5 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-jcc-bg flex items-center justify-center text-jcc-muted group-hover:bg-jcc-navy group-hover:text-white transition-colors">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-jcc-navy">Unschedule</p>
                        <p className="text-[10px] text-jcc-muted font-medium">Remove from public view</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto text-jcc-border group-hover:text-jcc-navy" />
                    </button>

                    <button
                      onClick={() => openConfirm({
                        title: "Cancel Match?",
                        description: "Are you sure? Registrations will be preserved, but registration will be disabled.",
                        variant: "danger",
                        onConfirm: () => handleStatusChange("cancelled")
                      })}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-jcc-border hover:border-jcc-red hover:shadow-lg hover:shadow-jcc-red/5 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-jcc-red/[0.05] flex items-center justify-center text-jcc-red group-hover:bg-jcc-red group-hover:text-white transition-colors">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-jcc-navy text-jcc-red">Cancel Match</p>
                        <p className="text-[10px] text-jcc-muted font-medium">Emergency cancellation</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto text-jcc-border group-hover:text-jcc-red" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Status Feedback */}
            <AnimatePresence>
              {status === "success" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2 text-jcc-turf text-sm font-bold bg-jcc-turf/[0.06] p-3 rounded-xl border border-jcc-turf/10">
                  <CheckCircle2 className="w-4 h-4" /> Action completed successfully!
                </motion.div>
              )}
              {status === "error" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2 text-jcc-red text-sm font-bold bg-jcc-red/[0.06] p-3 rounded-xl border border-jcc-red/10">
                  <AlertCircle className="w-4 h-4" /> An error occurred. Please try again.
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
