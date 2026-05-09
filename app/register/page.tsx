"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Wifi,
  ExternalLink,
  Loader2,
  Send,
  Trophy,
  Calendar,
} from "lucide-react";
import SectionHeading from "@/components/SectionHeading";
import { supabase } from "@/lib/supabase";

interface Match {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  location_map_url: string;
  player_limit: number;
  status: "open" | "full" | "closed" | "unscheduled" | "cancelled";
}

interface Registration {
  id: string;
  name: string;
  phone: string;
  cricket_role: string;
  status: "confirmed" | "waitlist";
}

export default function RegisterPage() {
  const [match, setMatch] = useState<Match | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<"idle" | "success" | "error" | "duplicate" | "pending_approval">("idle");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    cricket_role: "all-rounder",
  });

  const [registrationMode, setRegistrationMode] = useState<"existing" | "new">("existing");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [existingPlayer, setExistingPlayer] = useState<any>(null);
  const [lookupError, setLookupError] = useState("");

  useEffect(() => {
    fetchMatchAndRegistrations();
  }, []);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phone) return;
    
    try {
      setLookupLoading(true);
      setLookupError("");
      const response = await fetch("/api/player/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone }),
      });
      
      const data = await response.json();
      if (data.found) {
        setExistingPlayer(data.player);
        setFormData({
          ...formData,
          name: data.player.name,
          cricket_role: data.player.cricket_role,
        });
      } else {
        setLookupError("No member found with this number. Please register as a new member.");
      }
    } catch (err) {
      setLookupError("Error looking up member. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const fetchMatchAndRegistrations = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .gte("match_date", today)
        .order("match_date", { ascending: true })
        .limit(1)
        .single();

      if (matchError) {
        if (matchError.code === "PGRST116") {
          setMatch(null);
          setLoading(false);
          return;
        }
        throw matchError;
      }
      
      setMatch(matchData);

      if (matchData) {
        const { data: regData, error: regError } = await supabase
          .from("registrations")
          .select("*")
          .eq("match_id", matchData.id)
          .order("created_at", { ascending: true });

        if (regError) throw regError;
        setRegistrations(regData || []);
      }
    } catch (error: any) {
      console.error("Error fetching match data details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;

    try {
      setSubmitting(true);
      setFormStatus("idle");

      // 3. New Member Mode: Just create player and wait for approval
      if (registrationMode === "new") {
        // 1. Check if player exists by phone
        let { data: playerData, error: playerError } = await supabase
          .from("players")
          .select("id, approval_status")
          .eq("phone", formData.phone)
          .maybeSingle();

        if (playerError) throw playerError;

        if (playerData) {
          if (playerData.approval_status === "approved") {
            setLookupError("You are already an approved member. Please use the 'Existing Member' tab.");
            setSubmitting(false);
            return;
          }
          setFormStatus("pending_approval");
          setSubmitting(false);
          return;
        }

        // 2. Create new player with pending status
        const { error: createError } = await supabase
          .from("players")
          .insert([
            {
              name: formData.name,
              phone: formData.phone,
              cricket_role: formData.cricket_role,
              approval_status: "pending"
            },
          ]);

        if (createError) throw createError;
        setFormStatus("pending_approval");
        setFormData({ name: "", phone: "", cricket_role: "all-rounder" });
        setSubmitting(false);
        return;
      }

      // Existing Member Mode
      let player_id = existingPlayer?.id;
      if (!player_id) throw new Error("Player context lost");

      // 3. Check for duplicate registration for same match
      const isDuplicate = registrations.some((r) => r.phone === formData.phone);
      if (isDuplicate) {
        setFormStatus("duplicate");
        setSubmitting(false);
        return;
      }

      const confirmedCount = registrations.filter((r) => r.status === "confirmed").length;
      const registrationStatus = confirmedCount < match.player_limit ? "confirmed" : "waitlist";

      // 4. Create registration
      const { error: regError } = await supabase.from("registrations").insert([
        {
          match_id: match.id,
          player_id: player_id,
          name: formData.name,
          phone: formData.phone,
          cricket_role: formData.cricket_role,
          status: registrationStatus,
        },
      ]);

      if (regError) throw regError;

      setFormStatus("success");
      setFormData({ name: "", phone: "", cricket_role: "all-rounder" });
      setExistingPlayer(null);
      fetchMatchAndRegistrations(); 
    } catch (error: any) {
      console.error("Registration error:", error);
      setFormStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-jcc-bg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-jcc-blue animate-spin" />
          <p className="text-[12px] text-jcc-muted font-bold tracking-widest uppercase">Fetching Match Details...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen pt-28 pb-20 bg-jcc-bg flex items-center justify-center">
        <div className="text-center px-4">
          <SectionHeading
            title="Sunday Registration"
            subtitle="No match is currently scheduled."
            accentColor="blue"
          />
          <div className="glass-card p-12 max-w-md mx-auto mt-8">
            <CalendarCheck className="w-12 h-12 text-jcc-muted mx-auto mb-4 opacity-20" />
            <h2 className="text-2xl font-bold text-jcc-navy mb-2">Yet to be Scheduled</h2>
            <p className="text-jcc-muted text-sm">Stay tuned — registration will open once the next Sunday match is announced. Follow us on WhatsApp for updates!</p>
          </div>
        </div>
      </div>
    );
  }

  const confirmed = registrations.filter((p) => p.status === "confirmed");
  const waitlist = registrations.filter((p) => p.status === "waitlist");
  const slotsUsed = confirmed.length;
  const slotsTotal = match.player_limit;
  const fillPct = Math.min((slotsUsed / slotsTotal) * 100, 100);
  const isMatchFull = slotsUsed >= slotsTotal;

  const statusConfig = {
    open: {
      label: "Registration Open",
      color: "text-jcc-turf",
      bg: "bg-jcc-turf/[0.06]",
      border: "border-jcc-turf/15",
      dot: "bg-jcc-turf",
    },
    full: {
      label: "Match Full (Waitlist)",
      color: "text-jcc-gold",
      bg: "bg-jcc-gold/[0.06]",
      border: "border-jcc-gold/15",
      dot: "bg-jcc-gold",
    },
    closed: {
      label: "Registration Closed",
      color: "text-jcc-red",
      bg: "bg-jcc-red/[0.06]",
      border: "border-jcc-red/15",
      dot: "bg-jcc-red",
    },
    cancelled: {
      label: "Match Cancelled",
      color: "text-jcc-red",
      bg: "bg-jcc-red/[0.06]",
      border: "border-jcc-red/15",
      dot: "bg-jcc-red",
    },
    unscheduled: {
      label: "TBD",
      color: "text-jcc-muted",
      bg: "bg-jcc-bg",
      border: "border-jcc-border",
      dot: "bg-jcc-muted",
    },
  };

  const currentStatus = match.status === "open" && isMatchFull ? "full" : match.status;
  const sc = statusConfig[currentStatus as keyof typeof statusConfig];

  return (
    <div className="min-h-screen pt-28 pb-20 noise-overlay bg-jcc-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full ${sc.bg} border ${sc.border} mb-6`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dot} opacity-50`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${sc.dot}`} />
            </span>
            <span className={`text-[10px] font-bold ${sc.color} tracking-[0.25em] uppercase`}>
              {sc.label}
            </span>
          </motion.div>
        </div>

        <SectionHeading
          title="Sunday Registration"
          subtitle="Reserve your spot for this week's high-stakes encounter."
          accentColor="turf"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Match Info Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-8 sm:p-10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {[
                  {
                    icon: CalendarCheck,
                    color: "text-jcc-blue-deep",
                    label: "Match Date",
                    value: new Date(match.match_date).toLocaleDateString("en-IN", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                    }),
                  },
                  {
                    icon: Clock,
                    color: "text-jcc-purple",
                    label: "Reporting Time",
                    value: match.match_time,
                  },
                  {
                    icon: MapPin,
                    color: "text-jcc-gold",
                    label: "Venue",
                    value: match.location_name,
                    link: match.location_map_url
                  },
                  {
                    icon: Users,
                    color: "text-jcc-blue",
                    label: "Squad Size",
                    value: `${slotsTotal} Players (${slotsTotal / 2} vs ${slotsTotal / 2})`,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-jcc-bg border border-jcc-border flex items-center justify-center shrink-0">
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-jcc-muted uppercase tracking-widest font-bold mb-1">{item.label}</p>
                      <p className="text-[14px] font-bold text-jcc-navy">{item.value}</p>
                      {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-jcc-blue-deep hover:underline mt-2 font-bold">
                            View on Map <ExternalLink className="w-3 h-3" />
                          </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Registration Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-8 sm:p-10"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-jcc-turf/[0.06] border border-jcc-turf/15 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-jcc-turf" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-jcc-navy">Claim Your Spot</h3>
                  <p className="text-[12px] text-jcc-muted font-medium">Select your membership status to proceed.</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 p-1.5 bg-jcc-bg border border-jcc-border rounded-2xl mb-8">
                <button
                  onClick={() => { setRegistrationMode("existing"); setExistingPlayer(null); setFormStatus("idle"); }}
                  className={`flex-1 py-3 rounded-xl text-[12px] font-bold transition-all ${registrationMode === "existing" ? "bg-white text-jcc-navy shadow-sm border border-jcc-border" : "text-jcc-muted hover:text-jcc-navy"}`}
                >
                  Existing Member
                </button>
                <button
                  onClick={() => { setRegistrationMode("new"); setExistingPlayer(null); setFormStatus("idle"); }}
                  className={`flex-1 py-3 rounded-xl text-[12px] font-bold transition-all ${registrationMode === "new" ? "bg-white text-jcc-navy shadow-sm border border-jcc-border" : "text-jcc-muted hover:text-jcc-navy"}`}
                >
                  New Member
                </button>
              </div>

              {match.status === "unscheduled" ? (
                <div className="p-8 rounded-2xl bg-jcc-blue/[0.06] border border-jcc-blue/15 text-center">
                   <Calendar className="w-10 h-10 text-jcc-blue mx-auto mb-4" />
                   <h4 className="text-lg font-bold text-jcc-navy mb-2">No Sunday Match Scheduled Yet</h4>
                   <p className="text-[13px] font-medium text-jcc-muted">Stay tuned — registration will open once the next match is announced.</p>
                </div>
              ) : match.status === "cancelled" ? (
                <div className="p-8 rounded-2xl bg-jcc-red/[0.06] border border-jcc-red/15 text-center">
                   <AlertCircle className="w-10 h-10 text-jcc-red mx-auto mb-4" />
                   <h4 className="text-lg font-bold text-jcc-red mb-2">Match Cancelled</h4>
                   <p className="text-[13px] font-medium text-jcc-red/80">This match has been cancelled due to unforeseen circumstances. Registered player data has been safely archived below.</p>
                </div>
              ) : match.status === "closed" ? (
                <div className="p-6 rounded-2xl bg-jcc-red/[0.06] border border-jcc-red/15 text-center">
                   <AlertCircle className="w-8 h-8 text-jcc-red mx-auto mb-3" />
                   <p className="text-[14px] font-bold text-jcc-red">Registration is currently closed for this match.</p>
                </div>
              ) : formStatus === "pending_approval" ? (
                <div className="p-8 rounded-2xl bg-jcc-blue/[0.06] border border-jcc-blue/15 text-center">
                   <div className="w-12 h-12 rounded-full bg-jcc-blue flex items-center justify-center mx-auto mb-4 shadow-lg shadow-jcc-blue/20">
                     <Clock className="w-6 h-6 text-white" />
                   </div>
                   <h4 className="text-xl font-bold text-jcc-navy mb-2">Request Received!</h4>
                   <p className="text-jcc-muted text-[14px] mb-6 leading-relaxed">
                     Your joining request has been sent to admin for approval. <br />
                     Once approved, you can register for Sunday matches using your phone number.
                   </p>
                   <button 
                    onClick={() => setFormStatus("idle")}
                    className="text-[12px] font-bold text-jcc-blue-deep hover:underline"
                   >
                     Back to Registration
                   </button>
                </div>
              ) : formStatus === "success" ? (
                <div className="p-8 rounded-2xl bg-jcc-turf/[0.06] border border-jcc-turf/15 text-center">
                   <div className="w-12 h-12 rounded-full bg-jcc-turf flex items-center justify-center mx-auto mb-4 shadow-lg shadow-jcc-turf/20">
                     <CheckCircle2 className="w-6 h-6 text-white" />
                   </div>
                   <h4 className="text-xl font-bold text-jcc-navy mb-2">Registration Successful!</h4>
                   <p className="text-jcc-muted text-[14px] mb-6">You&apos;ve been added to the {registrations.filter(r => r.phone === formData.phone)[0]?.status || 'match'} list. See you on the pitch!</p>
                   <button 
                    onClick={() => setFormStatus("idle")}
                    className="text-[12px] font-bold text-jcc-blue-deep hover:underline"
                   >
                     Register another player
                   </button>
                </div>
              ) : registrationMode === "existing" ? (
                <div className="space-y-6">
                  {!existingPlayer ? (
                    <form onSubmit={handleLookup} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-jcc-muted uppercase tracking-widest px-1">Registered Phone Number</label>
                        <div className="relative">
                          <input 
                            required
                            type="tel"
                            placeholder="e.g. 9876543210"
                            className="w-full px-5 py-3.5 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-jcc-navy text-[14px] font-medium"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          />
                          <button 
                            type="submit"
                            disabled={lookupLoading || !formData.phone}
                            className="absolute right-2 top-2 bottom-2 px-4 rounded-lg bg-jcc-navy text-white text-[11px] font-bold hover:bg-jcc-blue transition-colors disabled:opacity-50"
                          >
                            {lookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Verify"}
                          </button>
                        </div>
                        {lookupError && (
                          <div className="flex flex-col gap-3 mt-4">
                            <p className="text-[12px] text-jcc-red font-medium flex items-center gap-2">
                              <AlertCircle className="w-3.5 h-3.5" /> {lookupError}
                            </p>
                            <button 
                              onClick={() => setRegistrationMode("new")}
                              className="text-[11px] font-bold text-jcc-blue hover:underline self-start"
                            >
                              Register as a new member instead →
                            </button>
                          </div>
                        )}
                      </div>
                    </form>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="p-6 rounded-2xl bg-jcc-blue/[0.04] border border-jcc-blue/10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white border border-jcc-border flex items-center justify-center overflow-hidden shrink-0">
                          {existingPlayer.image_url ? (
                            <img src={existingPlayer.image_url} alt={existingPlayer.name} className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-6 h-6 text-jcc-muted" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-jcc-navy">{existingPlayer.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-jcc-blue uppercase tracking-widest">{existingPlayer.cricket_role}</span>
                            <span className="w-1 h-1 rounded-full bg-jcc-border" />
                            <span className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest">{existingPlayer.team}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setExistingPlayer(null)}
                          className="ml-auto text-[10px] font-bold text-jcc-muted hover:text-jcc-red transition-colors"
                        >
                          Change
                        </button>
                      </div>

                      <form onSubmit={handleRegister}>
                        {existingPlayer.approval_status === "pending" ? (
                          <div className="p-4 rounded-xl bg-jcc-blue/[0.06] border border-jcc-blue/15 flex items-start gap-3 text-jcc-blue text-[13px] font-bold mb-4 leading-relaxed">
                            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                            Your membership request is pending admin approval. You can register for matches once approved.
                          </div>
                        ) : existingPlayer.approval_status === "rejected" ? (
                          <div className="p-4 rounded-xl bg-jcc-red/[0.06] border border-jcc-red/15 flex items-start gap-3 text-jcc-red text-[13px] font-bold mb-4 leading-relaxed">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            Your membership request was not approved. Please contact admin for details.
                          </div>
                        ) : (
                          <>
                            {formStatus === "duplicate" && (
                              <div className="p-4 rounded-xl bg-jcc-gold/[0.06] border border-jcc-gold/15 flex items-center gap-3 text-jcc-gold text-[13px] font-bold mb-4">
                                <AlertCircle className="w-4 h-4" />
                                You are already registered for this match.
                              </div>
                            )}
                            <button 
                              disabled={submitting}
                              type="submit"
                              className="w-full py-4 rounded-xl bg-jcc-turf text-white font-bold text-[14px] shadow-lg shadow-jcc-turf/20 hover:bg-jcc-turf-dim transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              Confirm Registration
                            </button>
                          </>
                        )}
                      </form>
                    </motion.div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-jcc-muted uppercase tracking-widest px-1">Full Name</label>
                      <input 
                        required
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        className="w-full px-5 py-3.5 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue focus:ring-4 focus:ring-jcc-blue/5 outline-none transition-all text-jcc-navy text-[14px] font-medium"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-jcc-muted uppercase tracking-widest px-1">Phone Number</label>
                      <input 
                        required
                        type="tel"
                        placeholder="e.g. 9876543210"
                        className="w-full px-5 py-3.5 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue focus:ring-4 focus:ring-jcc-blue/5 outline-none transition-all text-jcc-navy text-[14px] font-medium"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-jcc-muted uppercase tracking-widest px-1">Primary Role</label>
                    <select 
                      className="w-full px-5 py-3.5 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue focus:ring-4 focus:ring-jcc-blue/5 outline-none transition-all text-jcc-navy text-[14px] font-medium appearance-none"
                      value={formData.cricket_role}
                      onChange={(e) => setFormData({...formData, cricket_role: e.target.value})}
                    >
                      <option value="all-rounder">All-Rounder</option>
                      <option value="batter">Batter</option>
                      <option value="bowler">Bowler</option>
                      <option value="wicketkeeper">Wicketkeeper</option>
                    </select>
                  </div>

                  {formStatus === "duplicate" && (
                    <div className="p-4 rounded-xl bg-jcc-gold/[0.06] border border-jcc-gold/15 flex items-center gap-3 text-jcc-gold text-[13px] font-bold">
                      <AlertCircle className="w-4 h-4" />
                      You are already registered for this match.
                    </div>
                  )}

                  {formStatus === "error" && (
                    <div className="p-4 rounded-xl bg-jcc-red/[0.06] border border-jcc-red/15 flex items-center gap-3 text-jcc-red text-[13px] font-bold">
                      <AlertCircle className="w-4 h-4" />
                      Something went wrong. Please try again.
                    </div>
                  )}

                  <button 
                    disabled={submitting}
                    type="submit"
                    className="w-full py-4 rounded-xl bg-jcc-turf text-white font-bold text-[14px] shadow-lg shadow-jcc-turf/20 hover:bg-jcc-turf-dim transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {isMatchFull ? "Join Waitlist" : "Register Now"}
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-jcc-muted text-center font-medium">
                    By registering, you agree to follow the match-day protocols.
                  </p>
                </form>
              )}
            </motion.div>
          </div>

          {match.status !== "unscheduled" && (
            <div className="space-y-8">
              {/* Utilization Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-bold text-jcc-navy uppercase tracking-wider">Confirmed Slots</span>
                  <span className="text-[11px] font-mono text-jcc-muted tabular-nums font-bold">{slotsUsed} / {slotsTotal}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-jcc-border overflow-hidden mb-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className={`h-full rounded-full bg-gradient-to-r ${isMatchFull ? 'from-jcc-gold/60 to-jcc-gold' : 'from-jcc-blue-deep/60 to-jcc-blue-deep'}`}
                  />
                </div>
                {isMatchFull && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-jcc-gold/[0.06] border border-jcc-gold/15 text-[11px] text-jcc-gold font-bold leading-relaxed">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Squad limit reached. New entries will join the standby list.</span>
                  </div>
                )}
              </motion.div>

              {/* Squad Lists */}
              <div className="space-y-4">
                <div className="glass-card p-6">
                  <h3 className="text-[11px] font-bold text-jcc-navy uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-jcc-turf" />
                    Squad ({confirmed.length})
                  </h3>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                    {confirmed.length > 0 ? confirmed.map((player, i) => (
                      <div key={player.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-jcc-bg/50 border border-jcc-border group hover:border-jcc-turf/30 transition-all duration-300">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-jcc-muted w-3">{i + 1}</span>
                          <span className="text-[12px] text-jcc-navy font-bold truncate max-w-[100px]">{player.name}</span>
                        </div>
                        <span className="text-[9px] text-jcc-muted font-bold uppercase tracking-widest">{player.cricket_role}</span>
                      </div>
                    )) : (
                      <p className="text-[11px] text-jcc-muted italic font-medium">No confirmed players yet.</p>
                    )}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="text-[11px] font-bold text-jcc-navy uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5 text-jcc-gold" />
                    Stand-by ({waitlist.length})
                  </h3>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                    {waitlist.length > 0 ? waitlist.map((player, i) => (
                      <div key={player.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-jcc-bg/50 border border-jcc-border group hover:border-jcc-gold/30 transition-all duration-300">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-jcc-muted w-3">W{i + 1}</span>
                          <span className="text-[12px] text-jcc-muted font-bold truncate max-w-[100px]">{player.name}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-[11px] text-jcc-muted italic font-medium">Waitlist is empty.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rules Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-8 mt-12"
        >
          <h3 className="text-[13px] font-bold text-jcc-navy uppercase tracking-widest mb-6 flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-jcc-turf" />
            Match-Day Protocol
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Arrive 15 minutes before match time for warm-up.",
              "Wear proper cricket attire and sports shoes.",
              "Helmet is mandatory for batting.",
              "Respect the umpire's decision — no arguments.",
              "Confirm your attendance by Saturday 8 PM.",
              "Stay hydrated — carry your own water bottle.",
            ].map((rule, i) => (
              <li key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-jcc-bg/30 border border-jcc-border">
                <span className="w-6 h-6 rounded-lg bg-white border border-jcc-border text-jcc-blue-deep text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  {i + 1}
                </span>
                <span className="text-[13px] text-jcc-muted leading-relaxed font-medium">{rule}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
