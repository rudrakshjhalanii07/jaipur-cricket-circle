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
  Info,
  Send
} from "lucide-react";
import SectionHeading from "@/components/SectionHeading";
import { optimizeImage } from "@/lib/image-optimize";
import { getDiceBearUrl } from "@/lib/avatar";
import { supabase } from "@/lib/supabase";

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
  const [portalMode, setPortalMode] = useState<"login" | "signup">("login");
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

  // Get responsive tags matching player group role
  const getBadgeStyle = (tag: string) => {
    const cleanTag = tag.toLowerCase().replace(/_/g, "-");
    if (cleanTag.includes("captain") && !cleanTag.includes("vice")) return "tag-captain";
    if (cleanTag.includes("vice-captain")) return "tag-vice-captain";
    if (cleanTag.includes("founder") || cleanTag.includes("founding")) return "tag-founding-member";
    return "tag-batter"; // default
  };

  return (
    <div className="min-h-screen pt-36 pb-20 relative overflow-hidden hero-gradient">
      {/* Visual background layers */}
      <div className="absolute inset-0 stadium-glow opacity-50 z-0 pointer-events-none" />
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Render Title & Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 mb-6"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-jcc-accent" />
            <span className="text-[10px] font-black text-white/50 tracking-[0.25em] uppercase">
              {verifiedPlayer ? "Legend Workstation" : "Secure Member Authentication"}
            </span>
          </motion.div>
        </div>

        <SectionHeading
          title={verifiedPlayer ? "Your Profile" : "Member Portal"}
          subtitle={
            verifiedPlayer
              ? "Refine your cricket stats, showcase batting specialties, and perfect your public profile."
              : "Login with your registered number, or sign up to request JCC membership."
          }
          accentColor="blue"
          priority
        />

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
                className="w-full max-w-lg"
              >
                <div className="premium-card p-8 md:p-10 relative overflow-hidden">

                  {/* Glassmorphic stadium details */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-jcc-accent/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Portal Mode Tab Switcher */}
                  <div className="flex gap-2 p-1.5 bg-black/40 border border-white/10 rounded-2xl mb-7">
                    <button
                      type="button"
                      onClick={() => { setPortalMode("login"); setSignupStatus("idle"); setSignupError(""); }}
                      className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${portalMode === "login" ? "bg-white/10 text-white shadow-xl border border-white/10" : "text-white/40 hover:text-white"}`}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPortalMode("signup"); setOtpToken(null); setOtpDigits(Array(6).fill("")); setErrorMsg(""); setSuccessMsg(""); }}
                      className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${portalMode === "signup" ? "bg-white/10 text-white shadow-xl border border-white/10" : "text-white/40 hover:text-white"}`}
                    >
                      Sign Up
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
                              className="space-y-6"
                            >
                              <div className="text-center space-y-2">
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Request Access</h3>
                                <p className="text-xs text-white/50">Enter the phone number registered during your member sign-up.</p>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Registered Phone Number</label>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold font-[var(--font-heading)]">+91</span>
                                  <input
                                    type="tel"
                                    required
                                    placeholder="9988776655"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/20 text-sm font-bold focus:border-jcc-accent/40 focus:bg-white/[0.05] focus:outline-none transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                                  />
                                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                </div>
                                <p className="text-[9px] text-white/30 flex items-start gap-1.5 mt-1.5">
                                  <Info className="w-3 h-3 text-jcc-accent shrink-0 mt-0.5" />
                                  <span>Example format: 9988776655. Make sure it matches your registration record.</span>
                                </p>
                              </div>

                              <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full btn-vibrant-blue justify-center py-4"
                              >
                                {isLoading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                                    <span>Searching Registry...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>Verify Phone</span>
                                    <ArrowRight className="w-4 h-4 text-black" />
                                  </>
                                )}
                              </button>

                              <p className="text-[10px] text-white/30 text-center">
                                New member?{" "}
                                <button
                                  type="button"
                                  onClick={() => { setPortalMode("signup"); setErrorMsg(""); setSuccessMsg(""); }}
                                  className="text-jcc-accent font-black hover:underline"
                                >
                                  Sign up here
                                </button>
                              </p>
                            </motion.form>
                          ) : (

                            // 1B. OTP Code Verification Form
                            <motion.form
                              key="otp-form"
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              onSubmit={handleVerifyOtp}
                              className="space-y-6"
                            >
                              <div className="text-center space-y-2">
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Security Check</h3>
                                <p className="text-xs text-white/50">A 6-digit passcode has been generated for your number.</p>
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
                                      className="w-full h-12 sm:h-14 rounded-xl bg-white/[0.03] border border-white/10 text-white text-center text-lg font-black focus:border-jcc-accent/70 focus:bg-white/[0.05] focus:outline-none transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
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
                                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                                      <span>Securing Credentials...</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="w-4 h-4 text-black" />
                                      <span>Unlock Dashboard</span>
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
                        <div className="text-center space-y-2">
                          <h3 className="text-xl font-black text-white uppercase tracking-tight">Join the Circle</h3>
                          <p className="text-xs text-white/50">Submit your details for admin review. You&apos;ll be approved before your first Sunday match.</p>
                        </div>

                        {/* Full Name */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Full Name</label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="e.g. Rahul Sharma"
                              value={signupFormData.name}
                              onChange={(e) => setSignupFormData({ ...signupFormData, name: e.target.value })}
                              className="w-full pl-10 pr-4 py-4 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/20 text-sm font-bold focus:border-jcc-accent/40 focus:bg-white/[0.05] focus:outline-none transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                            />
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          </div>
                        </div>

                        {/* Phone Number */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Phone Number</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold font-[var(--font-heading)]">+91</span>
                            <input
                              type="tel"
                              required
                              placeholder="9988776655"
                              value={signupFormData.phone}
                              onChange={(e) => setSignupFormData({ ...signupFormData, phone: e.target.value.replace(/[^0-9+]/g, "") })}
                              className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/20 text-sm font-bold focus:border-jcc-accent/40 focus:bg-white/[0.05] focus:outline-none transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                            />
                            <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
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
                                      ? "bg-jcc-accent/5 border-jcc-accent shadow-[0_0_20px_rgba(0,194,255,0.1)]"
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
                          <label className="text-[10px] font-black uppercase text-white/40 tracking-wider">Profile Photo (Optional)</label>
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
                              <Loader2 className="w-4 h-4 animate-spin text-black" />
                              <span>
                                {signupUploadStage === "optimizing" && "Optimizing Photo..."}
                                {signupUploadStage === "uploading" && `Uploading... ${signupUploadProgress}%`}
                                {signupUploadStage === "saving" && "Saving Record..."}
                                {signupUploadStage === "idle" && "Processing..."}
                              </span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 text-black" />
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

                      {/* Player metadata text labels */}
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <h4 className="text-lg font-black tracking-tight text-white">{name || "Anonymous Member"}</h4>
                        <div className="flex flex-wrap justify-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${getBadgeStyle(verifiedPlayer.member_tag)}`}>
                            {verifiedPlayer.member_tag.toUpperCase().replace(/_/g, " ")}
                          </span>
                          <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/5 text-white/55 border border-white/10">
                            {verifiedPlayer.team}
                          </span>
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
                        className="w-full btn-ghost py-3.5 text-xs justify-center hover:border-red-400/40 hover:text-red-400 transition-colors"
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
                                      ? "bg-jcc-accent/5 border-jcc-accent shadow-[0_0_20px_rgba(0,194,255,0.1)]" 
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
                                      ? "bg-jcc-accent text-black border-jcc-accent font-black shadow-[0_0_15px_rgba(0,194,255,0.15)]" 
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
                            placeholder="Share your cricketing journey, preferred batting positions, iconic shots, or sunday circle achievements..."
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
                              <Loader2 className="w-4 h-4 animate-spin text-black" />
                              <span>Saving Dossier...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 text-black" />
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
