"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
  Calendar,
  Camera,
  Crown,
  Shield,
  Activity,
} from "lucide-react";
import SectionHeading from "@/components/SectionHeading";
import { supabase } from "@/lib/supabase";
import { fadeUp, staggerContainer, VIEWPORT_CONFIG } from "@/lib/animations";
import { optimizeImage } from "@/lib/image-optimize";
import { getDiceBearUrl } from "@/lib/avatar";

interface Match {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  location_map_url: string;
  player_limit: number;
  status: "open" | "full" | "closed" | "unscheduled" | "cancelled";
}

interface PlayerJoinedDetails {
  image_url: string | null;
  team: string | null;
  member_tag: string | null;
  group_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
}

interface Registration {
  id: string;
  player_id: string;
  name: string;
  phone: string;
  cricket_role: string;
  status: "registered" | "waitlist";
  players?: PlayerJoinedDetails | PlayerJoinedDetails[];
}

interface MatchRole {
  player_id: string;
  role: string;
  match_id: string;
}

interface Player {
  id: string;
  name: string;
  phone: string;
  cricket_role: string;
  approval_status: "pending" | "approved" | "rejected";
  team?: string;
  image_url?: string;
}

// Helper functions to safely extract joined player details
const getPlayerDetails = (player: Registration): PlayerJoinedDetails | null => {
  const pData = player.players;
  if (!pData) return null;
  if (Array.isArray(pData)) {
    return pData[0] || null;
  }
  return pData;
};

const getRoleBadgeStyle = (role: string) => {
  const r = role.toLowerCase().trim();
  if (r === "all-rounder") return "bg-cyan-500/10 border-cyan-500/35 text-cyan-400 border-[1px]";
  if (r === "batter") return "bg-sky-500/10 border-sky-500/35 text-sky-400 border-[1px]";
  if (r === "bowler") return "bg-emerald-500/10 border-emerald-500/35 text-emerald-400 border-[1px]";
  if (r === "wicketkeeper") return "bg-amber-500/10 border-amber-500/35 text-amber-400 border-[1px]";
  return "bg-white/5 border-white/10 text-white/50 border-[1px]";
};

const formatCricketStyles = (batting?: string | null, bowling?: string | null) => {
  if (!batting && !bowling) return "";
  const parts: string[] = [];
  if (batting) {
    if (batting.toLowerCase().includes("right")) parts.push("RHB");
    else if (batting.toLowerCase().includes("left")) parts.push("LHB");
    else parts.push(batting);
  }
  if (bowling && bowling !== "N/A" && bowling !== "None") {
    const b = bowling.toLowerCase();
    if (b.includes("right-arm fast") || b.includes("right arm fast")) parts.push("RAF");
    else if (b.includes("right-arm medium") || b.includes("right arm medium")) parts.push("RAM");
    else if (b.includes("right-arm offbreak") || b.includes("offbreak")) parts.push("RAO");
    else if (b.includes("right-arm legbreak") || b.includes("legbreak")) parts.push("RAL");
    else if (b.includes("left-arm fast") || b.includes("left arm fast")) parts.push("LAF");
    else if (b.includes("left-arm medium") || b.includes("left arm medium")) parts.push("LAM");
    else if (b.includes("left-arm offbreak") || b.includes("orthodox")) parts.push("LAO");
    else if (b.includes("left-arm legbreak") || b.includes("chinaman")) parts.push("LAC");
    else parts.push(bowling);
  }
  return parts.join(" • ");
};

const getRoleDetails = (role: string) => {
  const r = role.toLowerCase().trim();
  if (r === "all-rounder") return { abbr: "AR", emoji: "⚡" };
  if (r === "batter") return { abbr: "BAT", emoji: "🏏" };
  if (r === "bowler") return { abbr: "BOWL", emoji: "🟢" };
  if (r === "wicketkeeper") return { abbr: "WK", emoji: "🧤" };
  return { abbr: role.toUpperCase(), emoji: "🏏" };
};

const renderSpecialBadges = (memberTag?: string | null, groupRole?: string | null, matchRole?: string | null) => {
  const badges = [];
  const isFounder = memberTag === "founding-member";
  
  if (isFounder) {
    badges.push(
      <span key="founder" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-400/10 border border-amber-400/20 text-amber-400 scale-[0.9] origin-left shadow-sm">
        <Crown className="w-2.5 h-2.5 shrink-0" />
        Founder
      </span>
    );
  }

  // Dynamic match leadership roles
  if (matchRole === "captain") {
    badges.push(
      <span key="match-captain" className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-jcc-gold text-black border border-jcc-gold scale-[0.9] origin-left shadow-md flex items-center shrink-0">
        <Crown className="w-2.5 h-2.5 shrink-0" />
        Match Captain
      </span>
    );
  } else if (matchRole === "vice-captain") {
    badges.push(
      <span key="match-vc" className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-jcc-accent text-black border border-jcc-accent scale-[0.9] origin-left shadow-md flex items-center shrink-0">
        <Shield className="w-2.5 h-2.5 shrink-0" />
        Match VC
      </span>
    );
  }
  
  if (groupRole === "captain" || memberTag === "captain") {
    badges.push(
      <span key="captain" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400 scale-[0.9] origin-left shadow-sm animate-pulse">
        <Shield className="w-2.5 h-2.5 shrink-0 text-red-400" />
        Captain
      </span>
    );
  } else if (groupRole === "vice-captain" || memberTag === "vice-captain") {
    badges.push(
      <span key="vc" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 text-blue-400 scale-[0.9] origin-left shadow-sm">
        <Shield className="w-2.5 h-2.5 shrink-0 text-blue-400" />
        VC
      </span>
    );
  } else if (groupRole === "admin") {
    badges.push(
      <span key="admin" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-purple-500/10 border border-purple-500/20 text-purple-400 scale-[0.9] origin-left shadow-sm">
        Admin
      </span>
    );
  }
  
  return badges.length > 0 ? (
    <div className="flex gap-1 items-center flex-wrap">
      {badges}
    </div>
  ) : null;
};

const getTeamCardStyles = (team: string | null) => {
  const t = team ? team.replace(/\s+/g, '').toLowerCase() : "unassigned";
  
  if (t === "mavericks") {
    return {
      borderStyle: "border-jcc-accent/10 bg-[#001f33]/15",
      hoverStyle: "hover:border-jcc-accent/30 hover:bg-[#002e4d]/25",
      nameColor: "text-jcc-accent font-black",
      glowColor: "rgba(0, 194, 255, 0.15)",
      teamBadgeStyle: "bg-cyan-500/5 text-cyan-400 border-cyan-500/20",
      avatarRingStyle: "border-cyan-400/30 group-hover:border-cyan-400 ring-cyan-400/5 group-hover:ring-cyan-400/20",
    };
  } else if (t === "neurostrikers" || t === "neuro strikers") {
    return {
      borderStyle: "border-jcc-ball-red/10 bg-[#33000d]/15",
      hoverStyle: "hover:border-jcc-ball-red/30 hover:bg-[#4d0014]/25",
      nameColor: "text-jcc-ball-red font-black",
      glowColor: "rgba(255, 77, 77, 0.12)",
      teamBadgeStyle: "bg-red-500/5 text-red-400 border-red-500/20",
      avatarRingStyle: "border-red-500/30 group-hover:border-red-500 ring-red-500/5 group-hover:ring-red-500/20",
    };
  }
  
  // Unassigned/Default
  return {
    borderStyle: "border-white/5 bg-white/[0.02]",
    hoverStyle: "hover:border-white/20 hover:bg-white/[0.04]",
    nameColor: "text-white",
    glowColor: "rgba(255, 255, 255, 0.05)",
    teamBadgeStyle: "bg-white/5 text-white/40 border-white/10",
    avatarRingStyle: "border-white/10 group-hover:border-white/30 ring-white/5",
  };
};

export default function RegisterPage() {
  const [match, setMatch] = useState<Match | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [matchRoles, setMatchRoles] = useState<MatchRole[]>([]);
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
  const [existingPlayer, setExistingPlayer] = useState<Player | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarError, setAvatarError] = useState<string>("");
  const [registrationError, setRegistrationError] = useState<string>("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"idle" | "optimizing" | "uploading" | "saving">("idle");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAvatarError("");
    
    if (!file) {
      return;
    }

    // 1. Verify original file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("Invalid file type. Only JPG, JPEG, PNG, and WEBP are allowed.");
      return;
    }

    // 2. Reject files larger than 10MB before processing
    const maxOriginalSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxOriginalSize) {
      setAvatarError("Image is too large. Please upload a photo under 10MB.");
      return;
    }

    // 3. Trigger image optimization asynchronously
    setIsOptimizing(true);
    setUploadStage("optimizing");
    optimizeImage(file)
      .then((result) => {
        setAvatarFile(result.file);
        setAvatarPreview(result.previewUrl);
        console.log(`[JCC Image Optimizer] Original size: ${Math.round(result.originalSize / 1024)}KB | Optimized WebP size: ${Math.round(result.optimizedSize / 1024)}KB (${result.width}x${result.height})`);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Image optimization failed.";
        setAvatarError(msg);
        setAvatarFile(null);
        setAvatarPreview("");
      })
      .finally(() => {
        setIsOptimizing(false);
        setUploadStage("idle");
      });
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview("");
    }
    setAvatarError("");
  };

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);


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
      console.error("Lookup error:", err);
      setLookupError("Error looking up member. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  async function fetchMatchAndRegistrations() {
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
          .select("*, players(image_url, team, member_tag, group_role, batting_style, bowling_style)")
          .eq("match_id", matchData.id)
          .order("created_at", { ascending: true });

        if (regError) throw regError;
        setRegistrations(regData || []);

        const { data: roleData, error: roleError } = await supabase
          .from("match_player_roles")
          .select("*")
          .eq("match_id", matchData.id);

        if (roleError) {
          console.error("Error fetching match player roles:", roleError);
        } else {
          setMatchRoles(roleData || []);
        }
      }
    } catch (error) {
      console.error("Error fetching match data details:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMatchAndRegistrations();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const uploadWithProgress = (file: File, onProgress: (pct: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/player/upload-avatar", true);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const resData = JSON.parse(xhr.responseText);
            resolve(resData.publicUrl);
          } catch {
            reject(new Error("Invalid server response."));
          }
        } else {
          try {
            const resData = JSON.parse(xhr.responseText);
            reject(new Error(resData.error || "Failed to upload profile picture."));
          } catch {
            reject(new Error(`Upload failed with status code ${xhr.status}.`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error during upload. Please check your connection."));
      };

      const formData = new FormData();
      formData.append("file", file);
      xhr.send(formData);
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;

    try {
      setSubmitting(true);
      setFormStatus("idle");
      setRegistrationError("");

      // 3. New Member Mode: Just create player and wait for approval
      if (registrationMode === "new") {
        // 1. Check if player exists by phone
        const { data: playerData, error: playerError } = await supabase
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

        // Upload image first if file selected
        let imageUrl = null;
        if (avatarFile) {
          setUploadStage("uploading");
          setUploadProgress(0);
          try {
            imageUrl = await uploadWithProgress(avatarFile, (progress) => {
              setUploadProgress(progress);
            });
            setUploadStage("saving");
          } catch (uploadErr: unknown) {
            const msg = uploadErr instanceof Error ? uploadErr.message : "Failed to upload profile picture.";
            throw new Error(msg);
          }
        }

        // 2. Create new player with pending status and avatar url
        const { error: createError } = await supabase
          .from("players")
          .insert([
            {
              name: formData.name,
              phone: formData.phone,
              cricket_role: formData.cricket_role,
              approval_status: "pending",
              image_url: imageUrl
            },
          ]);

        if (createError) throw createError;
        
        // Clean up avatar state on success
        setAvatarFile(null);
        if (avatarPreview) {
          URL.revokeObjectURL(avatarPreview);
          setAvatarPreview("");
        }
        
        setFormStatus("pending_approval");
        setFormData({ name: "", phone: "", cricket_role: "all-rounder" });
        setSubmitting(false);
        return;
      }

      // Existing Member Mode
      const player_id = existingPlayer?.id;
      if (!player_id) throw new Error("Player context lost");

      // 3. Check for duplicate registration for same match
      const isDuplicate = registrations.some((r) => r.phone === formData.phone);
      if (isDuplicate) {
        setFormStatus("duplicate");
        setSubmitting(false);
        return;
      }

      const registeredCount = registrations.filter((r) => r.status === "registered").length;
      const registrationStatus = registeredCount < match.player_limit ? "registered" : "waitlist";

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
    } catch (error: unknown) {
      console.error("Registration error:", error);
      const errMsg = error instanceof Error ? error.message : "System error. Try again later.";
      setRegistrationError(errMsg);
      setFormStatus("error");
    } finally {
      setSubmitting(false);
      setUploadStage("idle");
      setUploadProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 stadium-glow opacity-30 z-0" />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <Loader2 className="w-8 h-8 text-jcc-accent animate-spin" />
          <p className="text-[12px] text-white/60 font-black tracking-widest uppercase">Fetching Match Details...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen pt-36 pb-20 relative overflow-hidden hero-gradient flex items-center justify-center">
        <div className="absolute inset-0 stadium-glow opacity-30 z-0" />
        <div className="text-center px-4 relative z-10">
          <SectionHeading
            title="Sunday Registration"
            subtitle="No match is currently scheduled."
            accentColor="blue"
          />
          <div className="premium-card p-12 max-w-md mx-auto mt-8">
            <CalendarCheck className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2 uppercase">Yet to be Scheduled</h2>
            <p className="text-white/60 text-sm font-medium">Stay tuned — registration will open once the next Sunday match is announced. Follow us on WhatsApp for updates!</p>
          </div>
        </div>
      </div>
    );
  }

  const confirmed = registrations.filter((p) => p.status === "registered");
  const waitlist = registrations.filter((p) => p.status === "waitlist");
  const slotsUsed = confirmed.length;
  const slotsTotal = match.player_limit;
  const fillPct = Math.min((slotsUsed / slotsTotal) * 100, 100);
  const isMatchFull = slotsUsed >= slotsTotal;

  const batterCount = confirmed.filter(p => p.cricket_role.toLowerCase().trim() === "batter").length;
  const bowlerCount = confirmed.filter(p => p.cricket_role.toLowerCase().trim() === "bowler").length;
  const allRounderCount = confirmed.filter(p => p.cricket_role.toLowerCase().trim() === "all-rounder").length;
  const keeperCount = confirmed.filter(p => p.cricket_role.toLowerCase().trim() === "wicketkeeper").length;



  const statusConfig = {
    open: {
      label: "Registration Open",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
      dot: "bg-emerald-400",
    },
    full: {
      label: "Match Full (Waitlist)",
      color: "text-jcc-gold",
      bg: "bg-jcc-gold/10",
      border: "border-jcc-gold/20",
      dot: "bg-jcc-gold",
    },
    closed: {
      label: "Registration Closed",
      color: "text-jcc-ball-red",
      bg: "bg-jcc-ball-red/10",
      border: "border-jcc-ball-red/20",
      dot: "bg-jcc-ball-red",
    },
    cancelled: {
      label: "Match Cancelled",
      color: "text-jcc-ball-red",
      bg: "bg-jcc-ball-red/10",
      border: "border-jcc-ball-red/20",
      dot: "bg-jcc-ball-red",
    },
    unscheduled: {
      label: "TBD",
      color: "text-white/40",
      bg: "bg-white/5",
      border: "border-white/10",
      dot: "bg-white/20",
    },
  };

  const currentStatus = match.status === "open" && isMatchFull ? "full" : match.status;
  const sc = statusConfig[currentStatus as keyof typeof statusConfig];

  return (
    <div className="min-h-screen pt-36 pb-20 relative overflow-hidden hero-gradient">
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 stadium-glow opacity-50 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full ${sc.bg} border ${sc.border} mb-6 shadow-xl`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dot} opacity-50`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${sc.dot}`} />
            </span>
            <span className={`text-[10px] font-black ${sc.color} tracking-[0.25em] uppercase`}>
              {sc.label}
            </span>
          </motion.div>
        </div>

        <SectionHeading
          title="Sunday Registration"
          subtitle="Reserve your spot for this week's high-stakes encounter."
          accentColor="turf"
        />

        {/* ENLARGED MATCH DETAILS BOX (FULL WIDTH DASHBOARD) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10"
        >
          {/* Core Match Information */}
          <div className="lg:col-span-6 premium-card p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden group">
            {/* Ambient inner gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-jcc-accent/5 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-jcc-accent animate-pulse" />
                <span className="text-[10px] font-black text-jcc-accent uppercase tracking-[0.3em]">Official Match fixture</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-8 leading-none">
                JCC Weekly Sunday Clash
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 relative z-10">
              {[
                {
                  icon: CalendarCheck,
                  color: "text-jcc-accent",
                  label: "Match Date",
                  value: new Date(match.match_date).toLocaleDateString("en-IN", {
                    weekday: "long", day: "numeric", month: "long",
                  }),
                  subValue: new Date(match.match_date).toLocaleDateString("en-IN", {
                    year: "numeric"
                  }),
                },
                {
                  icon: Clock,
                  color: "text-purple-400",
                  label: "Reporting Time",
                  value: match.match_time,
                  subValue: "Assemble on Pitch",
                },
                {
                  icon: Users,
                  color: "text-emerald-400",
                  label: "Squad Limit",
                  value: `${slotsTotal} Players`,
                  subValue: `${slotsTotal / 2} vs ${slotsTotal / 2} Matchup`,
                },
              ].map((item) => (
                <div key={item.label} className="flex flex-col p-4 rounded-2xl bg-white/[0.02] border border-white/5 shadow-inner hover:border-white/10 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <p className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-black mb-1">{item.label}</p>
                  <p className="text-[15px] font-black text-white uppercase tracking-tight leading-tight">{item.value}</p>
                  <p className="text-[10px] font-medium text-white/40 mt-1">{item.subValue}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Enormous Venue Map Card */}
          <div className="lg:col-span-6 premium-card p-8 sm:p-10 flex flex-col justify-between border-jcc-gold/25 relative overflow-hidden group">
            {/* Background ambient glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-jcc-gold/5 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-jcc-gold animate-bounce" />
                <span className="text-[10px] font-black text-jcc-gold uppercase tracking-[0.3em]">Stadium Location</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-tight">
                    {match.location_name}
                  </h3>
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
                    JAIPUR, RAJASTHAN
                  </p>
                </div>
                
                {match.location_map_url && (
                  <a
                    href={match.location_map_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-jcc-gold/10 border border-jcc-gold/20 hover:bg-jcc-gold hover:text-black transition-all duration-300 text-[11px] font-black uppercase tracking-wider shrink-0"
                  >
                    <span>Get Directions</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Responsive Live Interactive Google Map */}
              {match.location_name && (
                <div className="relative w-full h-[220px] sm:h-[260px] rounded-2xl overflow-hidden border border-white/10 shadow-inner group/map">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(match.location_name + ", Jaipur")}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    className="w-full h-full rounded-2xl grayscale invert opacity-70 group-hover/map:grayscale-0 group-hover/map:invert-0 group-hover/map:opacity-100 transition-all duration-700"
                  />
                  <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-2xl" />
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className={`${match.status !== "unscheduled" ? "lg:col-span-5" : "lg:col-span-12"} space-y-8`}>
            {/* Registration Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="premium-card p-8 sm:p-10"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shadow-inner">
                  <ClipboardList className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight">Claim Your Spot</h3>
                  <p className="text-[12px] text-white/30 font-bold uppercase tracking-widest mt-1">Select your membership status to proceed.</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 p-1.5 bg-black/40 border border-white/10 rounded-2xl mb-8">
                <button
                  onClick={() => { setRegistrationMode("existing"); setExistingPlayer(null); setFormStatus("idle"); }}
                  className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${registrationMode === "existing" ? "bg-white/10 text-white shadow-xl border border-white/10" : "text-white/40 hover:text-white"}`}
                >
                  Existing Member
                </button>
                <button
                  onClick={() => { setRegistrationMode("new"); setExistingPlayer(null); setFormStatus("idle"); }}
                  className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${registrationMode === "new" ? "bg-white/10 text-white shadow-xl border border-white/10" : "text-white/40 hover:text-white"}`}
                >
                  New Member
                </button>
              </div>

              {match.status === "unscheduled" ? (
                <div className="p-8 rounded-2xl bg-jcc-accent/5 border border-jcc-accent/10 text-center">
                   <Calendar className="w-10 h-10 text-jcc-accent mx-auto mb-4" />
                   <h4 className="text-lg font-black text-white mb-2 uppercase">No Sunday Match Scheduled Yet</h4>
                   <p className="text-[13px] font-medium text-white/40">Stay tuned — registration will open once the next match is announced.</p>
                </div>
              ) : match.status === "cancelled" ? (
                <div className="p-8 rounded-2xl bg-jcc-ball-red/5 border border-jcc-ball-red/10 text-center">
                   <AlertCircle className="w-10 h-10 text-jcc-ball-red mx-auto mb-4" />
                   <h4 className="text-lg font-black text-jcc-ball-red mb-2 uppercase">Match Cancelled</h4>
                   <p className="text-[13px] font-medium text-jcc-ball-red/60">This match has been cancelled due to unforeseen circumstances.</p>
                </div>
              ) : match.status === "closed" ? (
                <div className="p-6 rounded-2xl bg-jcc-ball-red/5 border border-jcc-ball-red/10 text-center">
                   <AlertCircle className="w-8 h-8 text-jcc-ball-red mx-auto mb-3" />
                   <p className="text-[14px] font-black text-jcc-ball-red uppercase tracking-widest">Registration is currently closed.</p>
                </div>
              ) : formStatus === "pending_approval" ? (
                <div className="p-8 rounded-2xl bg-jcc-accent/10 border border-jcc-accent/20 text-center">
                   <div className="w-14 h-14 rounded-full bg-jcc-accent flex items-center justify-center mx-auto mb-6 shadow-lg shadow-jcc-accent/40">
                     <Clock className="w-7 h-7 text-black" />
                   </div>
                   <h4 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Request Received!</h4>
                   <p className="text-white/60 text-[14px] mb-8 leading-relaxed font-medium">
                     Your joining request has been sent to admin for approval. <br />
                     Once approved, you can register for Sunday matches using your phone number.
                   </p>
                   <button 
                    onClick={() => setFormStatus("idle")}
                    className="text-[11px] font-black text-jcc-accent hover:underline uppercase tracking-widest"
                   >
                     Back to Registration
                   </button>
                </div>
              ) : formStatus === "success" ? (
                <div className="p-8 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 text-center">
                   <div className="w-14 h-14 rounded-full bg-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-400/40">
                     <CheckCircle2 className="w-7 h-7 text-black" />
                   </div>
                   <h4 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Registration Successful!</h4>
                   <p className="text-white/60 text-[14px] mb-8 font-medium">You&apos;ve been added to the {registrations.filter(r => r.phone === formData.phone)[0]?.status || 'match'} list. See you on the pitch!</p>
                   <button 
                    onClick={() => setFormStatus("idle")}
                    className="text-[11px] font-black text-emerald-400 hover:underline uppercase tracking-widest"
                   >
                     Register another player
                   </button>
                </div>
              ) : registrationMode === "existing" ? (
                <div className="space-y-6">
                  {!existingPlayer ? (
                    <form onSubmit={handleLookup} className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Registered Phone Number</label>
                        <div className="relative">
                          <input 
                            required
                            type="tel"
                            placeholder="e.g. 9876543210"
                            className="w-full px-6 py-4 rounded-2xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black placeholder:text-white/10 shadow-inner"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          />
                          <button 
                            type="submit"
                            disabled={lookupLoading || !formData.phone}
                            className="absolute right-2 top-2 bottom-2 px-6 rounded-xl bg-jcc-accent text-jcc-seam text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                          </button>
                        </div>
                        {lookupError && (
                          <div className="flex flex-col gap-4 mt-6">
                            <p className="text-[12px] text-jcc-ball-red font-black uppercase tracking-widest flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" /> {lookupError}
                            </p>
                            <button 
                              onClick={() => setRegistrationMode("new")}
                              className="text-[11px] font-black text-jcc-accent hover:underline self-start uppercase tracking-widest"
                            >
                              Register as a new member instead →
                            </button>
                          </div>
                        )}
                      </div>
                    </form>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                      <div className="p-6 rounded-2xl bg-jcc-accent/10 border border-jcc-accent/20 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-xl">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={existingPlayer.image_url || getDiceBearUrl(existingPlayer.name, existingPlayer.team)}
                            alt={existingPlayer.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.currentTarget;
                              const fallback = getDiceBearUrl(existingPlayer.name, existingPlayer.team);
                              if (img.src !== fallback) img.src = fallback;
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-black text-white uppercase tracking-tight">{existingPlayer.name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black text-jcc-accent uppercase tracking-[0.2em]">{existingPlayer.cricket_role}</span>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{existingPlayer.team}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setExistingPlayer(null)}
                          className="text-[10px] font-black text-white/30 hover:text-jcc-ball-red transition-colors uppercase tracking-widest"
                        >
                          Change
                        </button>
                      </div>

                      <form onSubmit={handleRegister}>
                        {existingPlayer.approval_status === "pending" ? (
                          <div className="p-5 rounded-2xl bg-jcc-accent/10 border border-jcc-accent/20 flex items-start gap-4 text-jcc-accent text-[13px] font-black uppercase tracking-widest mb-4 leading-relaxed italic">
                            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                            Wait! Membership request is pending admin approval.
                          </div>
                        ) : existingPlayer.approval_status === "rejected" ? (
                          <div className="p-5 rounded-2xl bg-jcc-ball-red/10 border border-jcc-ball-red/20 flex items-start gap-4 text-jcc-ball-red text-[13px] font-black uppercase tracking-widest mb-4 leading-relaxed italic">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            Membership request was not approved.
                          </div>
                        ) : (
                          <>
                            {formStatus === "duplicate" && (
                              <div className="p-5 rounded-2xl bg-jcc-gold/10 border border-jcc-gold/20 flex items-center gap-4 text-jcc-gold text-[13px] font-black uppercase tracking-widest mb-4">
                                <AlertCircle className="w-4 h-4" />
                                Already registered for this match!
                              </div>
                            )}
                            <button 
                              disabled={submitting}
                              type="submit"
                              className="w-full py-5 rounded-2xl btn-vibrant-blue text-black text-[14px] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-wider font-black"
                            >
                              {submitting ? (
                                <>
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span>RESERVING SPOT...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-5 h-5" />
                                  <span>CONFIRM SUNDAY SPOT</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </form>
                    </motion.div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Full Name</label>
                      <input 
                        required
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        className="w-full px-6 py-4 rounded-2xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black placeholder:text-white/10 shadow-inner"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Phone Number</label>
                      <input 
                        required
                        type="tel"
                        placeholder="e.g. 9876543210"
                        className="w-full px-6 py-4 rounded-2xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black placeholder:text-white/10 shadow-inner"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Primary Role</label>
                    <div className="relative">
                      <select 
                        className="w-full px-6 py-4 rounded-2xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[15px] font-black appearance-none shadow-inner"
                        value={formData.cricket_role}
                        onChange={(e) => setFormData({...formData, cricket_role: e.target.value})}
                      >
                        <option value="all-rounder" className="bg-jcc-navy">All-Rounder</option>
                        <option value="batter" className="bg-jcc-navy">Batter</option>
                        <option value="bowler" className="bg-jcc-navy">Bowler</option>
                        <option value="wicketkeeper" className="bg-jcc-navy">Wicketkeeper</option>
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">
                      Profile Photo (Optional)
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-black/40 border border-white/10 hover:border-white/20 transition-all duration-300">
                      <div className="relative group w-20 h-20 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-2xl transition-all hover:border-jcc-accent">
                        {isOptimizing ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-jcc-accent animate-spin" />
                          </div>
                        ) : avatarPreview ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                            {uploadStage === "uploading" && (
                              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                                <Loader2 className="w-5 h-5 text-jcc-accent animate-spin mb-1" />
                                <span className="text-[10px] font-black text-jcc-accent">{uploadProgress}%</span>
                              </div>
                            )}
                            {uploadStage === "saving" && (
                              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mb-1" />
                                <span className="text-[9px] font-black text-emerald-400">SAVING...</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-white/20 group-hover:text-jcc-accent transition-colors">
                            <Camera className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 text-center sm:text-left space-y-2">
                        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                          <label className={`px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-wider text-white hover:bg-white/10 hover:text-jcc-accent transition-all cursor-pointer ${(isOptimizing || submitting) ? 'opacity-50 pointer-events-none' : ''}`}>
                            Choose Photo
                            <input 
                              type="file"
                              accept="image/png, image/jpeg, image/jpg, image/webp"
                              className="hidden"
                              disabled={isOptimizing || submitting}
                              onChange={handleFileChange}
                            />
                          </label>
                          {avatarPreview && !isOptimizing && !submitting && (
                            <button
                              type="button"
                              onClick={handleRemoveAvatar}
                              className="px-4 py-2 rounded-xl bg-jcc-ball-red/10 border border-jcc-ball-red/20 text-[11px] font-black uppercase tracking-wider text-jcc-ball-red hover:bg-jcc-ball-red/20 transition-all"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider leading-relaxed">
                          Accepted: JPG, JPEG, PNG, WEBP (Max 10MB). <br />
                          <span className="text-jcc-accent">Automatically optimized to WebP (512x512) before upload.</span>
                        </p>
                        {avatarError && (
                          <p className="text-[11px] text-jcc-ball-red font-black uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {avatarError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {formStatus === "duplicate" && (
                    <div className="p-5 rounded-2xl bg-jcc-gold/10 border border-jcc-gold/20 flex items-center gap-4 text-jcc-gold text-[13px] font-black uppercase tracking-widest">
                      <AlertCircle className="w-4 h-4" />
                      Already registered for this match!
                    </div>
                  )}

                  {formStatus === "error" && (
                    <div className="p-5 rounded-2xl bg-jcc-ball-red/10 border border-jcc-ball-red/20 flex items-center gap-4 text-jcc-ball-red text-[13px] font-black uppercase tracking-widest">
                      <AlertCircle className="w-4 h-4" />
                      {registrationError || "System error. Try again later."}
                    </div>
                  )}

                  <button 
                    disabled={submitting}
                    type="submit"
                    className="w-full py-5 rounded-2xl btn-vibrant-blue text-black text-[14px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 uppercase tracking-wider font-black"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {uploadStage === "optimizing" && <span>Optimizing Photo...</span>}
                        {uploadStage === "uploading" && <span>Uploading Photo... {uploadProgress}%</span>}
                        {uploadStage === "saving" && <span>Saving Record...</span>}
                        {uploadStage === "idle" && <span>Processing...</span>}
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {isMatchFull ? <span>JOIN WAITLIST</span> : <span>CLAIM SUNDAY SPOT</span>}
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-white/20 text-center font-black uppercase tracking-[0.2em]">
                    Subject to match-day protocols & brotherhood spirit.
                  </p>
                </form>
              )}
            </motion.div>
          </div>

          {match.status !== "unscheduled" && (
            <div className="lg:col-span-7 space-y-8">
              {/* Utilization Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="premium-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-black text-white uppercase tracking-widest">Registered Slots</span>
                  <span className="text-[11px] font-mono text-white/40 tabular-nums font-black">{slotsUsed} / {slotsTotal}</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/5 border border-white/10 overflow-hidden mb-5 shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className={`h-full rounded-full ${isMatchFull ? 'bg-jcc-gold' : 'bg-jcc-accent'} shadow-[0_0_15px_rgba(0,194,255,0.4)]`}
                  />
                </div>
                {isMatchFull && (
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-jcc-gold/10 border border-jcc-gold/20 text-[11px] text-jcc-gold font-black uppercase tracking-widest leading-relaxed italic">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Squad limit reached. STANDBY ONLY.</span>
                  </div>
                )}
              </motion.div>

              {/* Squad Lists */}
              <div className="space-y-6">
                <div className="premium-card p-6">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em] mb-5 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    SQUAD ({confirmed.length})
                  </h3>

                  {/* Squad Balance Stats Dashboard */}
                  {confirmed.length > 0 && (
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 mb-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-jcc-accent animate-pulse" />
                          Squad Specialization Balance
                        </span>
                        <span className="text-[9px] font-black text-jcc-accent uppercase tracking-widest">
                          {confirmed.length} Registered
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "BAT", count: batterCount, color: "text-sky-400 border-sky-500/20 bg-sky-500/5", emoji: "🏏" },
                          { label: "AR", count: allRounderCount, color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5", emoji: "⚡" },
                          { label: "BWL", count: bowlerCount, color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5", emoji: "🟢" },
                          { label: "WK", count: keeperCount, color: "text-amber-400 border-amber-500/20 bg-amber-500/5", emoji: "🧤" },
                        ].map((stat) => (
                          <div key={stat.label} className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border ${stat.color} transition-all duration-300 hover:scale-[1.03]`}>
                            <div className="text-sm font-black leading-none flex items-center gap-1">
                              <span className="text-xs">{stat.emoji}</span>
                              <span className="font-mono text-[14px]">{stat.count}</span>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest mt-1.5 opacity-60">{stat.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-2 scrollbar-thin">
                    {confirmed.length > 0 ? confirmed.map((player, i) => {
                      const pDetails = getPlayerDetails(player);
                      const imageUrl = pDetails?.image_url;
                      const team = pDetails?.team || "Unassigned";
                      const initials = player.name ? player.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "🏏";
                      const matchRole = matchRoles.find((r) => r.player_id === player.player_id)?.role;
                      
                      const {
                        borderStyle,
                        hoverStyle,
                        nameColor,
                        glowColor,
                        teamBadgeStyle,
                        avatarRingStyle,
                      } = getTeamCardStyles(team);

                      const roleDetails = getRoleDetails(player.cricket_role);
                      const styleString = formatCricketStyles(pDetails?.batting_style, pDetails?.bowling_style);

                      return (
                        <div 
                          key={player.id} 
                          className={`relative flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all duration-300 group ${borderStyle} ${hoverStyle}`}
                          style={{
                            boxShadow: `0 0 0 0 ${glowColor}`,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 28px -6px ${glowColor}, 0 0 0 1px ${glowColor}`;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${glowColor}`;
                          }}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            {/* Monospace Jersey index */}
                            <span className="text-[12px] font-mono font-black text-white/20 w-5 flex-shrink-0 tabular-nums">
                              #{String(i + 1).padStart(2, '0')}
                            </span>
                            
                            {/* Profile Avatar with double ring glow */}
                            <div className={`w-11 h-11 rounded-xl overflow-hidden bg-white/5 border flex items-center justify-center shrink-0 shadow-lg ring-2 transition-all duration-300 group-hover:scale-105 ${avatarRingStyle}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
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
                            
                            {/* Name, Roles, Team details stack */}
                            <div className="flex flex-col min-w-0 gap-1">
                              <div className="flex items-center gap-2 flex-wrap text-left">
                                <span className={`text-[14px] font-black uppercase tracking-tight truncate leading-none ${nameColor}`}>
                                  {player.name}
                                </span>
                                {/* Authority tags */}
                                {renderSpecialBadges(pDetails?.member_tag, pDetails?.group_role, matchRole)}
                              </div>
                              
                              {/* Subtitle details (Team and Cricket Style) */}
                              <div className="flex items-center gap-2 flex-wrap leading-none">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${teamBadgeStyle}`}>
                                  {team}
                                </span>
                                {styleString && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-white/10 shrink-0" />
                                    <span className="text-[9px] font-semibold text-white/40 italic truncate max-w-[150px]">
                                      {styleString}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Rich Cricket Role Badge */}
                          <span className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest shrink-0 whitespace-nowrap shadow-sm flex items-center gap-1 transition-transform group-hover:scale-105 duration-300 ${getRoleBadgeStyle(player.cricket_role)}`}>
                            <span>{roleDetails.emoji}</span>
                            <span>{roleDetails.abbr}</span>
                          </span>
                        </div>
                      );
                    }) : (
                      <p className="text-[11px] text-white/20 italic font-black uppercase tracking-widest text-center py-4">Waiting for first signup...</p>
                    )}
                  </div>
                </div>

                <div className="premium-card p-6">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em] mb-5 flex items-center gap-3">
                    <Wifi className="w-4 h-4 text-jcc-gold" />
                    STAND-BY ({waitlist.length})
                  </h3>
                  <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                    {waitlist.length > 0 ? waitlist.map((player, i) => {
                      const pDetails = getPlayerDetails(player);
                      const imageUrl = pDetails?.image_url;
                      const team = pDetails?.team || "Unassigned";
                      const initials = player.name ? player.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "🏏";
                      const matchRole = matchRoles.find((r) => r.player_id === player.player_id)?.role;
                      const roleDetails = getRoleDetails(player.cricket_role);
                      const styleString = formatCricketStyles(pDetails?.batting_style, pDetails?.bowling_style);
                      
                      const {
                        borderStyle,
                        hoverStyle,
                        nameColor,
                        glowColor,
                        teamBadgeStyle,
                        avatarRingStyle,
                      } = getTeamCardStyles(team);

                      return (
                        <div 
                          key={player.id} 
                          className={`relative flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all duration-300 group ${borderStyle} ${hoverStyle}`}
                          style={{
                            boxShadow: `0 0 0 0 ${glowColor}`,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 28px -6px ${glowColor}, 0 0 0 1px ${glowColor}`;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${glowColor}`;
                          }}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            {/* Monospace standby position with gold accent */}
                            <span className="text-[11px] font-mono font-black text-jcc-gold w-5 flex-shrink-0 tabular-nums shadow-sm">
                              W{i + 1}
                            </span>
                            
                            {/* Profile Avatar with double ring glow */}
                            <div className={`w-11 h-11 rounded-xl overflow-hidden bg-white/5 border flex items-center justify-center shrink-0 shadow-lg ring-2 transition-all duration-300 group-hover:scale-105 ${avatarRingStyle}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
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
                            
                            {/* Name, Roles, Team details stack */}
                            <div className="flex flex-col min-w-0 gap-1">
                              <div className="flex items-center gap-2 flex-wrap text-left">
                                <span className={`text-[14px] font-black uppercase tracking-tight truncate leading-none ${nameColor}`}>
                                  {player.name}
                                </span>
                                {/* Authority tags */}
                                {renderSpecialBadges(pDetails?.member_tag, pDetails?.group_role, matchRole)}
                              </div>
                              
                              {/* Subtitle details (Team and Cricket Style) */}
                              <div className="flex items-center gap-2 flex-wrap leading-none">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${teamBadgeStyle}`}>
                                  {team}
                                </span>
                                {styleString && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-white/10 shrink-0" />
                                    <span className="text-[9px] font-semibold text-white/40 italic truncate max-w-[150px]">
                                      {styleString}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Rich Cricket Role Badge */}
                          <span className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest shrink-0 whitespace-nowrap shadow-sm flex items-center gap-1 transition-transform group-hover:scale-105 duration-300 ${getRoleBadgeStyle(player.cricket_role)}`}>
                            <span>{roleDetails.emoji}</span>
                            <span>{roleDetails.abbr}</span>
                          </span>
                        </div>
                      );
                    }) : (
                      <p className="text-[11px] text-white/10 italic font-black uppercase tracking-widest text-center py-4">Waitlist empty.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rules Section */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG}
          className="premium-card p-10 mt-16"
        >
          <motion.h3 variants={fadeUp} className="text-[14px] font-black text-white uppercase tracking-[0.4em] mb-8 flex items-center gap-4">
            <ClipboardList className="w-6 h-6 text-jcc-accent" />
            Match-Day Protocol
          </motion.h3>
          <motion.ul variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              "Arrive 15 minutes before match time for warm-up.",
              "Wear proper cricket attire and sports shoes.",
              "Helmet is mandatory for batting.",
              "Respect the umpire's decision — no arguments.",
              "Confirm your attendance by Saturday 8 PM.",
              "Stay hydrated — carry your own water bottle.",
            ].map((rule, i) => (
              <motion.li 
                key={i} 
                variants={fadeUp}
                className="flex items-start gap-5 p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
              >
                <span className="w-7 h-7 rounded-lg bg-jcc-accent text-black text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-jcc-accent/20">
                  {i + 1}
                </span>
                <span className="text-[14px] text-white/60 leading-relaxed font-medium">{rule}</span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </div>
  );
}
