"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Phone,
  ShieldCheck,
  Camera,
  Save,
  LogOut,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Award,
  Sparkles,
  Lock,
  ArrowRight,
  ShieldAlert,
  Flame,
  Send,
  BookOpen,
  BarChart3,
  Swords,
  CalendarCheck,
  UsersRound
} from "lucide-react";
import SectionHeading from "@/components/SectionHeading";
import { optimizeImage } from "@/lib/image-optimize";
import { getDiceBearUrl } from "@/lib/avatar";
import { supabase } from "@/lib/supabase";
import { getDisplayRole, getGovernanceRoleLabel } from "@/lib/member-role";

// Standard choice lists matching database values
const CRICKET_ROLES = [
  { value: "all-rounder", label: "All-Rounder", icon: Sparkles, desc: "Brings balance with both bat & ball" },
  { value: "batter", label: "Batter", icon: Flame, desc: "Specialist run-scorer of the side" },
  { value: "bowler", label: "Bowler", icon: Award, desc: "Strikes down the opposition wickets" },
  { value: "wicketkeeper", label: "Wicketkeeper", icon: ShieldCheck, desc: "The vigilant guardian behind stumps" }
];

const BATTING_STYLES = [
  { value: "Right-hand Bat", label: "Right-Handed" },
  { value: "Left-hand Bat", label: "Left-Handed" }
];

const BOWLING_STYLES = [
  { value: "N/A", label: "None / N/A" },
  { value: "Right-arm Fast", label: "Right-arm Fast" },
  { value: "Right-arm Medium", label: "Right-arm Medium" },
  { value: "Right-arm Offbreak", label: "Right-arm Offbreak" },
  { value: "Right-arm Legbreak", label: "Right-arm Legbreak" },
  { value: "Left-arm Fast", label: "Left-arm Fast" },
  { value: "Left-arm Medium", label: "Left-arm Medium" },
  { value: "Left-arm Offbreak", label: "Left-arm Offbreak (Orthodox)" },
  { value: "Left-arm Legbreak", label: "Left-arm Legbreak (Chinaman)" }
];

interface Player {
  id: string;
  name: string;
  phone: string;
  cricket_role: "all-rounder" | "batter" | "bowler" | "wicketkeeper";
  batting_style: string;
  bowling_style: string;
  bio: string;
  image_url: string | null;
  team: string;
  member_tag: string;
  group_role: string;
  governance_role: string | null;
  is_core_committee: boolean;
  is_exec_committee: boolean;
  approval_status: string;
}

export default function ProfilePage() {
  // Session & UI Phase states
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [verifiedPlayer, setVerifiedPlayer] = useState<Player | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Authentication Flow States
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [timerCount, setTimerCount] = useState(0);
  const [debugOtpCode, setDebugOtpCode] = useState<string | null>(null);

  // Form Field States
  const [name, setName] = useState("");
  const [cricketRole, setCricketRole] = useState<Player["cricket_role"]>("all-rounder");
  const [battingStyle, setBattingStyle] = useState("Right-hand Bat");
  const [bowlingStyle, setBowlingStyle] = useState("N/A");
  const [bio, setBio] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Action status triggers
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Avatar Upload States
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"idle" | "optimizing" | "uploading" | "saving" | "done" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sign-Up Mode States
  const [portalMode, setPortalMode] = useState<"login" | "signup">("signup");
  const [signupFormData, setSignupFormData] = useState({ name: "", phone: "", cricket_role: "all-rounder" });
  const [signupStatus, setSignupStatus] = useState<"idle" | "pending_approval" | "error">("idle");
  const [signupError, setSignupError] = useState("");
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);
  const [signupAvatarFile, setSignupAvatarFile] = useState<File | null>(null);
  const [signupAvatarPreview, setSignupAvatarPreview] = useState("");
  const [signupAvatarError, setSignupAvatarError] = useState("");
  const [isSignupOptimizing, setIsSignupOptimizing] = useState(false);
  const [signupUploadProgress, setSignupUploadProgress] = useState(0);
  const [signupUploadStage, setSignupUploadStage] = useState<"idle" | "optimizing" | "uploading" | "saving">("idle");

  // Cleanup signup avatar preview URL on unmount
  useEffect(() => {
    return () => {
      if (signupAvatarPreview) URL.revokeObjectURL(signupAvatarPreview);
    };
  }, [signupAvatarPreview]);

  // Quiet institutional proof for the entrance — verified member & archived
  // match counts, fetched once. Left null (renders as "—") if unavailable.
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [membersRes, matchesRes] = await Promise.all([
        supabase.from("players").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
        supabase.from("series_matches").select("id", { count: "exact", head: true }).not("winner_id", "is", null)
      ]);
      if (!membersRes.error) setMemberCount(membersRes.count ?? null);
      if (!matchesRes.error) setMatchCount(matchesRes.count ?? null);
    })();
  }, []);

  // Timer countdown hook
  useEffect(() => {
    if (timerCount > 0) {
      const interval = setInterval(() => {
        setTimerCount((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timerCount]);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("jcc_verified_session");
    const savedPlayer = localStorage.getItem("jcc_verified_player");
    
    if (savedToken && savedPlayer) {
      try {
        const parsedPlayer = JSON.parse(savedPlayer) as Player;
        setSessionToken(savedToken);
        setVerifiedPlayer(parsedPlayer);
        
        // Hydrate form states
        setName(parsedPlayer.name);
        setCricketRole(parsedPlayer.cricket_role);
        setBattingStyle(parsedPlayer.batting_style || "Right-hand Bat");
        setBowlingStyle(parsedPlayer.bowling_style || "N/A");
        setBio(parsedPlayer.bio || "");
        setImageUrl(parsedPlayer.image_url);
      } catch (err) {
        // Clear corrupt data
        localStorage.removeItem("jcc_verified_session");
        localStorage.removeItem("jcc_verified_player");
      }
    }
    setIsInitializing(false);
  }, []);

  // Autofocus shifting logic for separate OTP inputs
  const handleOtpDigitChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    // Auto shift focus forward
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Auto shift focus backward on backspace
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
      
      const newDigits = [...otpDigits];
      newDigits[index - 1] = "";
      setOtpDigits(newDigits);
    }
  };

  // Sign-Up: Handle avatar file selection and optimization
  const handleSignupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSignupAvatarError("");
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setSignupAvatarError("Invalid file type. Only JPG, JPEG, PNG, and WEBP are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSignupAvatarError("Image is too large. Please upload a photo under 10MB.");
      return;
    }

    setIsSignupOptimizing(true);
    setSignupUploadStage("optimizing");
    optimizeImage(file)
      .then((result) => {
        setSignupAvatarFile(result.file);
        setSignupAvatarPreview(result.previewUrl);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Image optimization failed.";
        setSignupAvatarError(msg);
        setSignupAvatarFile(null);
        setSignupAvatarPreview("");
      })
      .finally(() => {
        setIsSignupOptimizing(false);
        setSignupUploadStage("idle");
      });
  };

  const handleRemoveSignupAvatar = () => {
    setSignupAvatarFile(null);
    if (signupAvatarPreview) {
      URL.revokeObjectURL(signupAvatarPreview);
      setSignupAvatarPreview("");
    }
    setSignupAvatarError("");
  };

  const signupUploadWithProgress = (file: File, onProgress: (pct: number) => void): Promise<string> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/player/upload-avatar", true);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText).publicUrl); }
          catch { reject(new Error("Invalid server response.")); }
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).error || "Upload failed.")); }
          catch { reject(new Error(`Upload failed with status ${xhr.status}.`)); }
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload."));
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    });

  // Sign-Up: Submit new member request
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupStatus("idle");

    if (!signupAvatarFile) {
      setSignupAvatarError("Profile photo is required.");
      setSignupStatus("error");
      return;
    }

    try {
      setIsSubmittingSignup(true);

      const { data: existing, error: existErr } = await supabase
        .from("players")
        .select("id, approval_status")
        .eq("phone", signupFormData.phone.trim())
        .maybeSingle();

      if (existErr) throw existErr;

      if (existing) {
        if (existing.approval_status === "approved") {
          setSignupError("You are already an approved member. Please use the Login tab.");
          setSignupStatus("error");
        } else {
          setSignupStatus("pending_approval");
        }
        return;
      }

      let imageUrl = null;
      if (signupAvatarFile) {
        setSignupUploadStage("uploading");
        setSignupUploadProgress(0);
        imageUrl = await signupUploadWithProgress(signupAvatarFile, setSignupUploadProgress);
        setSignupUploadStage("saving");
      }

      const { error: createErr } = await supabase.from("players").insert([{
        name: signupFormData.name.trim(),
        phone: signupFormData.phone.trim(),
        cricket_role: signupFormData.cricket_role,
        approval_status: "pending",
        image_url: imageUrl
      }]);

      if (createErr) throw createErr;

      handleRemoveSignupAvatar();
      setSignupFormData({ name: "", phone: "", cricket_role: "all-rounder" });
      setSignupStatus("pending_approval");
    } catch (err: any) {
      setSignupError(err.message || "Something went wrong. Please try again.");
      setSignupStatus("error");
    } finally {
      setIsSubmittingSignup(false);
      setSignupUploadStage("idle");
      setSignupUploadProgress(0);
    }
  };

  // 1. Action: Request OTP verification SMS
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMsg("Please enter your registered phone number.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/player/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger verification code.");
      }

      setOtpToken(data.token);
      setDebugOtpCode(data.debugCode); // Load local developer simulator block
      setTimerCount(60); // Set resend cooldown to 60s
      setSuccessMsg("Verification code successfully generated.");
      
      // Auto focus first digit input block
      setTimeout(() => {
        document.getElementById("otp-input-0")?.focus();
      }, 100);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Action: Verify OTP entered by player
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const submittedCode = otpDigits.join("");
    if (submittedCode.length < 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }

    if (!otpToken) {
      setErrorMsg("Verification session has expired. Please request a new code.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/player/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: otpToken, code: submittedCode })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed. Please double check the code.");
      }

      // Save tokens & hydrate
      localStorage.setItem("jcc_verified_session", data.sessionToken);
      localStorage.setItem("jcc_verified_player", JSON.stringify(data.player));
      
      setSessionToken(data.sessionToken);
      setVerifiedPlayer(data.player);
      
      setName(data.player.name);
      setCricketRole(data.player.cricket_role);
      setBattingStyle(data.player.batting_style || "Right-hand Bat");
      setBowlingStyle(data.player.bowling_style || "N/A");
      setBio(data.player.bio || "");
      setImageUrl(data.player.image_url);

      setPhone("");
      setOtpToken(null);
      setOtpDigits(Array(6).fill(""));
      setDebugOtpCode(null);
      setSuccessMsg("Verification successful! Welcome to your profile board.");
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid code. Please try again.");
      // Shaker effect visual support: reset inputs
      setOtpDigits(Array(6).fill(""));
      document.getElementById("otp-input-0")?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Action: Handle Client-Side Image Selection & Compression & Upload
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");
    setUploadStage("optimizing");
    setUploadProgress(0);

    try {
      // Step-down quality compression and WebP formatting under 500KB client-side
      const compressed = await optimizeImage(file);
      
      setUploadStage("uploading");
      
      // Perform XHR request with progress tracking
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/player/upload-avatar");
      
      xhr.upload.onprogress = (progressEvent) => {
        if (progressEvent.lengthComputable) {
          const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(percentage);
        }
      };

      const uploadPromise = new Promise<{ publicUrl: string }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resData = JSON.parse(xhr.responseText);
              resolve(resData);
            } catch (err) {
              reject(new Error("Response parsing failed."));
            }
          } else {
            try {
              const resData = JSON.parse(xhr.responseText);
              reject(new Error(resData.error || `Upload failed with status code ${xhr.status}.`));
            } catch (err) {
              reject(new Error(`Upload failed with status code ${xhr.status}.`));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Network error during avatar upload."));
      });

      const formData = new FormData();
      formData.append("file", compressed.file);
      xhr.send(formData);

      const result = await uploadPromise;
      
      setUploadStage("saving");
      setImageUrl(result.publicUrl);
      setUploadStage("done");
      setSuccessMsg("Avatar uploaded and optimized successfully! Save profile to persist changes.");
    } catch (err: any) {
      setUploadStage("error");
      setErrorMsg(err.message || "Failed to process profile photo.");
    }
  };

  // 4. Action: Save updated profile details back to DB
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!sessionToken) {
      setErrorMsg("Session expired. Please log in again to verify.");
      return;
    }

    if (!name.trim()) {
      setErrorMsg("Display Name cannot be empty.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/player/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          updates: {
            name: name.trim(),
            cricket_role: cricketRole,
            batting_style: battingStyle,
            bowling_style: bowlingStyle,
            bio: bio.trim(),
            image_url: imageUrl
          }
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save profile changes.");
      }

      // Update local storage representation
      localStorage.setItem("jcc_verified_player", JSON.stringify(data.player));
      setVerifiedPlayer(data.player);
      setSuccessMsg("Profile dossier successfully updated!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to persist profile modifications.");
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Action: Logout / Flush session
  const handleLogout = () => {
    localStorage.removeItem("jcc_verified_session");
    localStorage.removeItem("jcc_verified_player");
    
    setSessionToken(null);
    setVerifiedPlayer(null);
    setName("");
    setBio("");
    setImageUrl(null);
    
    setErrorMsg("");
    setSuccessMsg("");
    setPhone("");
    setOtpToken(null);
    setOtpDigits(Array(6).fill(""));
  };

  // Loader screen while validating saved session keys
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 stadium-glow opacity-30 z-0" />
        <Loader2 className="w-8 h-8 text-jcc-accent animate-spin relative z-10" />
      </div>
    );
  }

  // Badge style keyed off the composed display role (same string every other
  // page shows), not the raw member_tag — a player whose leadership lives on
  // group_role (e.g. "Captain") previously fell through to the default style
  // because member_tag alone never contains "captain".
  const getBadgeStyle = (displayRole: string) => {
    const cleanRole = displayRole.toLowerCase();
    if (cleanRole.includes("captain") && !cleanRole.includes("vice")) return "tag-captain";
    if (cleanRole.includes("vice-captain") || cleanRole.includes("vice captain")) return "tag-vice-captain";
    if (cleanRole.includes("founder") || cleanRole.includes("founding")) return "tag-founding-member";
    return "tag-batter"; // default
  };

  return (
    <div className="min-h-screen page-top pb-20 relative overflow-hidden hero-gradient">
      {/* Visual background layers */}
      <div className="absolute inset-0 stadium-glow opacity-50 z-0 pointer-events-none" />
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

      {/* Faint archival ledger grid — enriches the paper, never distracts */}
      {!verifiedPlayer && (
        <div className="archival-ledger-grid absolute inset-0 z-0 pointer-events-none" />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">

        {/* Render Title & Header — authenticated workspace only; the
            unauthenticated entrance carries its own institutional heading
            in the left column below. */}
        {verifiedPlayer && (
          <>
            <div className="text-center mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 mb-6"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-jcc-accent" />
                <span className="text-[10px] font-black text-white/50 tracking-[0.25em] uppercase">
                  Legend Workstation
                </span>
              </motion.div>
            </div>

            <SectionHeading
              title="Your Profile"
              subtitle="Refine your cricket stats, showcase batting specialties, and perfect your public profile."
              accentColor="blue"
              priority
            />
          </>
        )}

        {/* Dynamic Alerts Banner */}
        <div className="max-w-xl mx-auto mb-8">
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-2xl bg-jcc-ball-red/10 border border-jcc-ball-red/20 text-jcc-ball-red text-xs font-bold flex items-start gap-3 backdrop-blur-md shadow-lg"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
            
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-2xl bg-jcc-green/10 border border-jcc-green/20 text-jcc-green text-xs font-bold flex items-start gap-3 backdrop-blur-md shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Authenticated Workspace vs Verification UI Panels */}
        <div className="w-full flex justify-center">
          <AnimatePresence mode="wait">
            
            {/* 1. Verification Flow Screens */}
            {!verifiedPlayer ? (
              <motion.div
                key="verify-portal"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-10 items-center"
              >
                {/* LEFT COLUMN — institutional story: what membership is, what it unlocks */}
                <div className="order-2 lg:order-1 lg:col-span-7 lg:pr-4">
                  <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 mb-7">
                    <ShieldCheck className="w-3.5 h-3.5 text-jcc-accent" />
                    <span className="text-[10px] font-black text-white/50 tracking-[0.25em] uppercase">
                      Members-Only Entrance
                    </span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl leading-[0.95] mb-6">
                    The Pavilion
                  </h1>

                  <p className="font-heading italic text-white/70 text-xl sm:text-2xl font-medium mb-6 leading-relaxed normal-case tracking-normal">
                    The records. The rivalries. The weeks.
                    <br />
                    Reserved for those inside the Circle.
                  </p>

                  <p className="text-sm text-white/50 leading-relaxed max-w-xl mb-10">
                    Every innings, every season, every weekly gathering — logged and kept for those who wear the JCC colours. Enter with your registered number, or request an invitation to join the Circle.
                  </p>

                  {/* Feature rows — what membership unlocks */}
                  <div className="space-y-5 mb-10">
                    {[
                      { icon: BookOpen, title: "Match Archive", desc: "Every match you've played, kept on record." },
                      { icon: BarChart3, title: "Career Statistics", desc: "Runs. Wickets. Awards." },
                      { icon: Swords, title: "Season History", desc: "Every score. Every chapter." },
                      { icon: CalendarCheck, title: "Registration Priority", desc: "Reserve your place each week." },
                      { icon: UsersRound, title: "Community Directory", desc: "Meet every member of the Circle." }
                    ].map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <div key={item.title} className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full border border-jcc-border bg-white flex items-center justify-center shrink-0 shadow-sm">
                            <ItemIcon className="w-4 h-4 text-jcc-accent-dark" />
                          </div>
                          <div className="pt-1.5">
                            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-white">{item.title}</p>
                            <p className="text-xs text-white/45 mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Quiet institutional proof */}
                  <div className="flex flex-wrap gap-x-10 gap-y-4 pt-7 border-t border-white/10">
                    <div>
                      <p className="text-2xl font-black font-[var(--font-heading)] text-white leading-none">{memberCount ?? "—"}</p>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mt-1.5">Verified Members</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black font-[var(--font-heading)] text-white leading-none">{matchCount ?? "—"}</p>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mt-1.5">Matches Archived</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-jcc-accent shrink-0" />
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">OTP Protected Access</p>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN — the invitation card */}
                <div className="order-1 lg:order-2 lg:col-span-5">
                <div className="premium-card portal-invite-card p-10 sm:p-12 md:p-14 relative overflow-hidden">

                  {/* Glassmorphic stadium details */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-jcc-accent/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Crest emblem — an elevated badge, not a form icon */}
                  <div className="flex flex-col items-center mb-9">
                    <div className="w-16 h-16 rounded-full bg-jcc-navy-light border border-jcc-accent/35 shadow-[0_14px_28px_-14px_rgba(212,175,55,0.5)] flex items-center justify-center">
                      <ShieldCheck className="w-7 h-7 text-jcc-accent-dark" strokeWidth={1.75} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-jcc-accent-dark mt-5">
                      Member Authentication
                    </p>
                  </div>

                  {/* Portal Mode Selector — elegant text tabs, gold underline slides between them */}
                  <div className="flex items-center justify-center gap-10 mb-10 pb-6 border-b border-jcc-border">
                    <button
                      type="button"
                      onClick={() => { setPortalMode("login"); setSignupStatus("idle"); setSignupError(""); }}
                      className="relative pb-3 group"
                    >
                      <span className={`text-[12px] font-black uppercase tracking-[0.15em] transition-colors duration-150 ${portalMode === "login" ? "text-white" : "text-white/35 group-hover:text-white/55"}`}>
                        Existing Member
                      </span>
                      {portalMode === "login" && (
                        <motion.span
                          layoutId="portal-tab-underline"
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute left-0 right-0 -bottom-[1px] h-[2px] rounded-full bg-gradient-to-r from-jcc-accent-dark via-jcc-accent to-jcc-accent-highlight"
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPortalMode("signup"); setOtpToken(null); setOtpDigits(Array(6).fill("")); setErrorMsg(""); setSuccessMsg(""); }}
                      className="relative pb-3 group"
                    >
                      <span className={`text-[12px] font-black uppercase tracking-[0.15em] transition-colors duration-150 ${portalMode === "signup" ? "text-white" : "text-white/35 group-hover:text-white/55"}`}>
                        New Member
                      </span>
                      {portalMode === "signup" && (
                        <motion.span
                          layoutId="portal-tab-underline"
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute left-0 right-0 -bottom-[1px] h-[2px] rounded-full bg-gradient-to-r from-jcc-accent-dark via-jcc-accent to-jcc-accent-highlight"
                        />
                      )}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {portalMode === "login" ? (
                      <motion.div
                        key="login-panel"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <AnimatePresence mode="wait">
                          {!otpToken ? (

                            // 1A. Phone Input Form
                            <motion.form
                              key="phone-form"
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              onSubmit={handleRequestOtp}
                            >
                              <div className="text-center mb-10">
                                <h3 className="text-2xl font-black text-white tracking-tight normal-case font-[var(--font-heading)] mb-3">Enter The Pavilion</h3>
                                <p className="text-xs text-white/45">Your registered number is your standing among the Circle.</p>
                              </div>

                              <div className="mb-9">
                                <label className="block text-[10px] font-black uppercase text-white/40 tracking-wider mb-2.5">Registered Phone Number</label>
                                <div className="relative">
                                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-jcc-text-muted text-sm font-bold font-[var(--font-heading)]">+91</span>
                                  <input
                                    type="tel"
                                    required
                                    placeholder="9988776655"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                                    className="portal-input w-full pl-14 pr-12 py-4 rounded-2xl text-sm font-bold tracking-wide"
                                  />
                                  <Phone className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-accent-dark/60" />
                                </div>
                                <p className="text-[10px] text-white/30 mt-2.5">Format: 9988776655</p>
                              </div>

                              <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full btn-vibrant-blue justify-center py-4"
                              >
                                {isLoading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-[#FFFFFF]" />
                                    <span>Searching Registry...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>Continue</span>
                                    <ArrowRight className="w-4 h-4 text-[#FFFFFF]" />
                                  </>
                                )}
                              </button>

                              <div className="mt-9 text-center">
                                <div className="flex items-center gap-4 mb-5">
                                  <span className="h-px flex-1 bg-jcc-border" />
                                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">Not part of the Circle?</span>
                                  <span className="h-px flex-1 bg-jcc-border" />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { setPortalMode("signup"); setErrorMsg(""); setSuccessMsg(""); }}
                                  className="text-[11px] font-black uppercase tracking-[0.15em] text-jcc-accent-dark hover:text-jcc-accent transition-colors duration-150"
                                >
                                  New Member →
                                </button>
                              </div>
                            </motion.form>
                          ) : (

                            // 1B. OTP Code Verification Form
                            <motion.form
                              key="otp-form"
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              onSubmit={handleVerifyOtp}
                              className="space-y-7"
                            >
                              <div className="text-center space-y-2.5 mb-1">
                                <h3 className="text-2xl font-black text-white tracking-tight normal-case font-[var(--font-heading)]">Verify Your Identity</h3>
                                <p className="text-xs text-white/45">A 6-digit passcode has been generated for your number.</p>
                              </div>

                              {/* Separate OTP Inputs Grid */}
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block text-center mb-4">Enter 6-Digit Passcode</label>
                                <div className="grid grid-cols-6 gap-2 sm:gap-3 max-w-sm mx-auto">
                                  {otpDigits.map((digit, idx) => (
                                    <input
                                      key={idx}
                                      id={`otp-input-${idx}`}
                                      type="text"
                                      maxLength={1}
                                      required
                                      value={digit}
                                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                      className="portal-input w-full h-12 sm:h-14 rounded-2xl text-center text-lg font-black"
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-col items-center gap-3">
                                <button
                                  type="submit"
                                  disabled={isLoading}
                                  className="w-full btn-vibrant-blue justify-center py-4"
                                >
                                  {isLoading ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin text-[#FFFFFF]" />
                                      <span>Securing Credentials...</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="w-4 h-4 text-[#FFFFFF]" />
                                      <span>Verify Identity</span>
                                    </>
                                  )}
                                </button>

                                <div className="flex items-center justify-between w-full px-1 text-[10px] text-white/40 mt-2">
                                  <span>Didn&apos;t get code?</span>
                                  {timerCount > 0 ? (
                                    <span className="flex items-center gap-1 font-bold text-white/60">
                                      <Clock className="w-3 h-3 text-jcc-accent" /> Resend in {timerCount}s
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={handleRequestOtp}
                                      className="text-jcc-accent font-bold hover:underline"
                                    >
                                      Request New Code
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Local Developer simulated SMS alert block */}
                              {debugOtpCode && (
                                <motion.div
                                  initial={{ opacity: 0, y: 15 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/5 relative"
                                >
                                  <div className="absolute top-2.5 right-2.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-accent opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-jcc-accent"></span>
                                  </div>
                                  <div className="flex gap-3">
                                    <ShieldAlert className="w-5 h-5 text-jcc-accent shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase text-jcc-accent tracking-wider leading-none">Simulation Console</p>
                                      <p className="text-[11px] text-white/70">
                                        Your phone number verification passcode is:
                                      </p>
                                      <div className="inline-block bg-white/5 border border-white/10 rounded px-2.5 py-1 text-sm font-black text-white tracking-widest mt-1">
                                        {debugOtpCode}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </motion.form>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ) : signupStatus === "pending_approval" ? (

                      // Sign-Up Success: Pending Approval State
                      <motion.div
                        key="signup-success"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="text-center space-y-6 py-4"
                      >
                        <div className="w-14 h-14 rounded-full bg-jcc-accent flex items-center justify-center mx-auto shadow-lg shadow-jcc-accent/40">
                          <Clock className="w-7 h-7 text-black" />
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-xl font-black text-white uppercase tracking-tight">Request Received!</h3>
                          <p className="text-xs text-white/50 leading-relaxed">
                            Your membership request has been sent to the admin for review. Once approved, you can log in using your phone number.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSignupStatus("idle"); setPortalMode("login"); }}
                          className="text-[11px] font-black text-jcc-accent hover:underline uppercase tracking-widest"
                        >
                          Back to Login
                        </button>
                      </motion.div>
                    ) : (

                      // Sign-Up Form
                      <motion.form
                        key="signup-panel"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                        onSubmit={handleSignup}
                        className="space-y-6"
                      >
                        <div className="text-center space-y-2.5 mb-1">
                          <h3 className="text-2xl font-black text-white tracking-tight normal-case font-[var(--font-heading)]">Become Member</h3>
                          <p className="text-xs text-white/45">Submit your details for admin review.</p>
                        </div>

                        {/* Full Name */}
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Full Name</label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="e.g. Rahul Sharma"
                              value={signupFormData.name}
                              onChange={(e) => setSignupFormData({ ...signupFormData, name: e.target.value })}
                              className="portal-input w-full pl-11 pr-4 py-4 rounded-2xl text-sm font-bold"
                            />
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-accent-dark/60" />
                          </div>
                        </div>

                        {/* Phone Number */}
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Phone Number</label>
                          <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-jcc-text-muted text-sm font-bold font-[var(--font-heading)]">+91</span>
                            <input
                              type="tel"
                              required
                              placeholder="9988776655"
                              value={signupFormData.phone}
                              onChange={(e) => setSignupFormData({ ...signupFormData, phone: e.target.value.replace(/[^0-9+]/g, "") })}
                              className="portal-input w-full pl-14 pr-12 py-4 rounded-2xl text-sm font-bold tracking-wide"
                            />
                            <Phone className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-accent-dark/60" />
                          </div>
                        </div>

                        {/* Cricket Role */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Primary Cricket Role</label>
                          <div className="grid grid-cols-2 gap-2">
                            {CRICKET_ROLES.map((role) => {
                              const IconComponent = role.icon;
                              const isSelected = signupFormData.cricket_role === role.value;
                              return (
                                <div
                                  key={role.value}
                                  onClick={() => setSignupFormData({ ...signupFormData, cricket_role: role.value })}
                                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-300 select-none ${
                                    isSelected
                                      ? "bg-jcc-accent/5 border-jcc-accent shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                                      : "bg-white/[0.02] border-white/10 hover:border-white/20"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <IconComponent className={`w-3.5 h-3.5 ${isSelected ? "text-jcc-accent" : "text-white/40"}`} />
                                    <div className={`w-2 h-2 rounded-full border ${isSelected ? "bg-jcc-accent border-jcc-accent" : "border-white/20"}`} />
                                  </div>
                                  <p className={`text-[10px] font-black uppercase ${isSelected ? "text-white" : "text-white/70"}`}>{role.label}</p>
                                  <p className="text-[8px] text-white/30 mt-0.5 leading-normal">{role.desc}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Profile Photo */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Profile Photo <span className="text-jcc-ball-red">*</span></label>
                          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-300">
                            <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                              {isSignupOptimizing ? (
                                <Loader2 className="w-5 h-5 text-jcc-accent animate-spin" />
                              ) : signupAvatarPreview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={signupAvatarPreview} alt="Preview" className="w-full h-full object-cover" />
                              ) : (
                                <Camera className="w-5 h-5 text-white/20" />
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <label className={`px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-white hover:bg-white/10 transition-all cursor-pointer ${(isSignupOptimizing || isSubmittingSignup) ? "opacity-50 pointer-events-none" : ""}`}>
                                  Choose Photo
                                  <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/jpg, image/webp"
                                    className="hidden"
                                    disabled={isSignupOptimizing || isSubmittingSignup}
                                    onChange={handleSignupFileChange}
                                  />
                                </label>
                                {signupAvatarPreview && !isSignupOptimizing && (
                                  <button
                                    type="button"
                                    onClick={handleRemoveSignupAvatar}
                                    className="px-3 py-1.5 rounded-lg bg-jcc-ball-red/10 border border-jcc-ball-red/20 text-[10px] font-black uppercase text-jcc-ball-red hover:bg-jcc-ball-red/20 transition-all"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                              <p className="text-[9px] text-white/30 font-bold uppercase tracking-wider leading-relaxed">
                                JPG, PNG, WEBP · Max 10MB · Auto-optimized
                              </p>
                              {signupAvatarError && (
                                <p className="text-[10px] text-jcc-ball-red font-black flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> {signupAvatarError}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {signupStatus === "error" && signupError && (
                          <p className="text-[11px] text-jcc-ball-red font-black flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {signupError}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={isSubmittingSignup}
                          className="w-full btn-vibrant-blue justify-center py-4"
                        >
                          {isSubmittingSignup ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-[#FFFFFF]" />
                              <span>
                                {signupUploadStage === "optimizing" && "Optimizing Photo..."}
                                {signupUploadStage === "uploading" && `Uploading... ${signupUploadProgress}%`}
                                {signupUploadStage === "saving" && "Saving Record..."}
                                {signupUploadStage === "idle" && "Processing..."}
                              </span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 text-[#FFFFFF]" />
                              <span>Submit Membership Request</span>
                            </>
                          )}
                        </button>

                        <p className="text-[9px] text-white/20 text-center font-black uppercase tracking-[0.2em]">
                          Pending admin approval before access is granted.
                        </p>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* Trust strip — quiet institutional proof, not marketing badges */}
                  <div className="flex items-center justify-center flex-wrap gap-x-7 gap-y-3 mt-11 pt-7 border-t border-jcc-border">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-jcc-accent-dark" strokeWidth={1.75} />
                      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40">Invitation Only</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-jcc-accent-dark" strokeWidth={1.75} />
                      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40">OTP Protected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-jcc-accent-dark" strokeWidth={1.75} />
                      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40">Private Member Records</span>
                    </div>
                  </div>
                </div>
                </div>
              </motion.div>
            ) : (

              // 2. Verified Active Profile Form Workspace
              <motion.div
                key="profile-workspace"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* LEFT COLUMN: Visual avatar & stats display */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="premium-card p-6 text-center space-y-6 relative overflow-hidden">
                      
                      {/* Interactive Avatar Upload Frame */}
                      <div className="flex flex-col items-center">
                        <div className="relative group cursor-pointer w-32 h-32 rounded-full border-2 border-white/10 hover:border-jcc-accent/50 overflow-hidden shadow-2xl transition-all duration-300">
                          <img 
                            src={imageUrl || getDiceBearUrl(name || verifiedPlayer.name, verifiedPlayer.team)} 
                            alt={name || "Member Profile"} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              const img = e.currentTarget;
                              const fallback = getDiceBearUrl(name || verifiedPlayer.name, verifiedPlayer.team);
                              if (img.src !== fallback) img.src = fallback;
                            }}
                          />
                          
                          {/* Image update overlay */}
                          <div 
                            onClick={() => fileInputRef.current?.click()} 
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-all duration-300"
                          >
                            <Camera className="w-5 h-5 text-white animate-pulse" />
                            <span className="text-[9px] font-black uppercase text-white tracking-widest">Update Photo</span>
                          </div>
                        </div>

                        {/* Hidden input trigger */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarSelect}
                          className="hidden"
                        />
                      </div>

                      {/* Live Image Optimization Progress bar */}
                      <AnimatePresence>
                        {uploadStage !== "idle" && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-left"
                          >
                            <div className="flex items-center justify-between text-[10px] font-black uppercase">
                              <span className="text-jcc-accent tracking-wider">
                                {uploadStage === "optimizing" && "Compressing Canvas (WebP)..."}
                                {uploadStage === "uploading" && "Uploading to Cloud..."}
                                {uploadStage === "saving" && "Updating States..."}
                                {uploadStage === "done" && "Upload Completed!"}
                                {uploadStage === "error" && "Upload Failed"}
                              </span>
                              {uploadStage === "uploading" && (
                                <span className="text-white/60">{uploadProgress}%</span>
                              )}
                            </div>
                            
                            {uploadStage === "uploading" && (
                              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-jcc-accent transition-all duration-300" 
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Player metadata text labels — role composed from the
                          same member_tag + group_role fields as the homepage
                          and Members directory, so it never disagrees with
                          those pages. */}
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <h4 className="text-lg font-black tracking-tight text-white">{name || "Anonymous Member"}</h4>
                        <div className="flex flex-wrap justify-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${getBadgeStyle(getDisplayRole(verifiedPlayer.member_tag, verifiedPlayer.group_role, verifiedPlayer.cricket_role))}`}>
                            {getDisplayRole(verifiedPlayer.member_tag, verifiedPlayer.group_role, verifiedPlayer.cricket_role)}
                          </span>
                          <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/5 text-white/55 border border-white/10">
                            {verifiedPlayer.team}
                          </span>
                          {(verifiedPlayer.is_core_committee || verifiedPlayer.is_exec_committee) && (
                            <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-jcc-accent/10 text-jcc-accent-dark border border-jcc-accent/25">
                              {verifiedPlayer.is_core_committee ? "Core Committee" : "Executive Committee"}
                              {verifiedPlayer.governance_role ? ` · ${getGovernanceRoleLabel(verifiedPlayer)}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Secondary security session card */}
                    <div className="premium-card p-6 space-y-4">
                      <h4 className="text-xs font-black uppercase text-white/40 tracking-widest flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-jcc-accent" /> Security Context
                      </h4>
                      <div className="text-xs space-y-3">
                        <div className="flex items-center justify-between text-white/60">
                          <span>Verified Phone:</span>
                          <span className="font-bold text-white font-[var(--font-heading)]">+91 {verifiedPlayer.phone}</span>
                        </div>
                        <div className="flex items-center justify-between text-white/60">
                          <span>Session Window:</span>
                          <span className="text-jcc-accent flex items-center gap-1 font-bold">
                            <Clock className="w-3 h-3" /> 1 Hour Active
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleLogout}
                        className="w-full btn-ghost py-3.5 text-xs justify-center hover:border-jcc-danger/40 hover:text-jcc-danger transition-colors"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Sign Out Portal</span>
                      </button>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Player dossier details form */}
                  <div className="lg:col-span-8">
                    <form onSubmit={handleSaveProfile} className="premium-card p-8 space-y-8">
                      
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <h3 className="text-lg font-black uppercase text-white tracking-wider">Member Dossier</h3>
                        <span className="text-[10px] font-black text-jcc-accent tracking-widest uppercase">ID: {verifiedPlayer.id.substring(0,8)}...</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Name Input */}
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Display Name</label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="E.g. Rudraksh Jhalani"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/20 text-sm font-bold focus:border-jcc-accent/40 focus:bg-white/[0.05] focus:outline-none transition-all duration-300"
                            />
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          </div>
                        </div>

                        {/* Cricket Role Select grid */}
                        <div className="space-y-3 md:col-span-2">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Specialty Cricket Role</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {CRICKET_ROLES.map((role) => {
                              const IconComponent = role.icon;
                              const isSelected = cricketRole === role.value;
                              return (
                                <div
                                  key={role.value}
                                  onClick={() => setCricketRole(role.value as Player["cricket_role"])}
                                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 select-none ${
                                    isSelected 
                                      ? "bg-jcc-accent/5 border-jcc-accent shadow-[0_0_20px_rgba(212,175,55,0.1)]" 
                                      : "bg-white/[0.02] border-white/10 hover:border-white/20"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <IconComponent className={`w-4 h-4 ${isSelected ? "text-jcc-accent" : "text-white/40"}`} />
                                    <div className={`w-2.5 h-2.5 rounded-full border ${isSelected ? "bg-jcc-accent border-jcc-accent" : "border-white/20"}`} />
                                  </div>
                                  <p className={`text-xs font-black uppercase ${isSelected ? "text-white" : "text-white/70"}`}>{role.label}</p>
                                  <p className="text-[9px] text-white/40 mt-1 leading-normal">{role.desc}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Batting Style Options */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Batting Style</label>
                          <div className="flex gap-2">
                            {BATTING_STYLES.map((style) => {
                              const isSelected = battingStyle === style.value;
                              return (
                                <button
                                  key={style.value}
                                  type="button"
                                  onClick={() => setBattingStyle(style.value)}
                                  className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all duration-300 ${
                                    isSelected 
                                      ? "bg-jcc-accent text-black border-jcc-accent font-black shadow-[0_0_15px_rgba(212,175,55,0.15)]" 
                                      : "bg-white/[0.02] text-white/40 border-white/10 hover:border-white/20"
                                  }`}
                                >
                                  {style.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bowling Style Selector */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Bowling Style</label>
                          <select
                            value={bowlingStyle}
                            onChange={(e) => setBowlingStyle(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-bold focus:border-jcc-accent/40 focus:bg-white/[0.05] focus:outline-none transition-all duration-300 appearance-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                            style={{
                              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "right 14px center",
                              backgroundSize: "14px"
                            }}
                          >
                            {BOWLING_STYLES.map((style) => (
                              <option key={style.value} value={style.value} className="bg-jcc-navy text-white">
                                {style.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Bio Textarea */}
                        <div className="space-y-2 md:col-span-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Public Bio / Dossier</label>
                            <span className={`text-[9px] font-bold ${bio.length > 250 ? "text-jcc-ball-red" : "text-white/30"}`}>
                              {bio.length} / 300 chars
                            </span>
                          </div>
                          <textarea
                            maxLength={300}
                            rows={4}
                            placeholder="Share your cricketing journey, preferred batting positions, iconic shots, or circle achievements..."
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/20 text-xs font-bold focus:border-jcc-accent/40 focus:bg-white/[0.05] focus:outline-none transition-all duration-300 resize-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                          />
                        </div>

                      </div>

                      {/* Save Changes button */}
                      <div className="flex justify-end pt-4 border-t border-white/5">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="btn-vibrant-blue px-8 py-3.5 text-xs"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-[#FFFFFF]" />
                              <span>Saving Dossier...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 text-[#FFFFFF]" />
                              <span>Save Profile</span>
                            </>
                          )}
                        </button>
                      </div>

                    </form>
                  </div>

                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
