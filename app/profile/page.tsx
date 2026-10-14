"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  Flame,
  Send,
  BookOpen,
  BarChart3,
  UsersRound
} from "lucide-react";
import { optimizeImage } from "@/lib/image-optimize";
import { getDiceBearUrl } from "@/lib/avatar";
import { supabase } from "@/lib/supabase";
import { getDisplayRole, getGovernanceRoleLabel } from "@/lib/member-role";
import MyStats from "@/components/profile/MyStats";
import Jaali from "@/components/Jaali";
import { teamByName } from "@/lib/teams";
import PhotoFramer from "@/components/PhotoFramer";
import { SHARP_WIDTH, focusStyle, parseFocus, withFocus, type PhotoFocus } from "@/lib/photo-focus";

const LABEL = "text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em]";
const FIELD_LABEL = "text-[10px] font-black uppercase tracking-[0.18em] text-jcc-blue/70";
const INPUT =
  "w-full rounded-xl border border-jcc-blue/15 bg-jcc-navy px-4 py-3.5 text-sm font-semibold text-jcc-blue placeholder:text-jcc-blue/50 transition focus:border-jcc-accent focus:outline-none focus:ring-4 focus:ring-jcc-accent/15";

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

/**
 * Bowling style as two taps — arm, then type — instead of a nine-item
 * dropdown. Composes the same stored values as BOWLING_STYLES
 * ("Right-arm Offbreak", "N/A", …).
 */
const BOWL_TYPES = [
  { value: "Fast", label: "Fast", hint: "Pace" },
  { value: "Medium", label: "Medium", hint: "Pace" },
  { value: "Offbreak", label: "Off-break", hint: "Spin" },
  { value: "Legbreak", label: "Leg-break", hint: "Spin" },
];

function BowlingPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const m = value.match(/^(Right|Left)-arm (\w+)$/);
  const arm = m ? m[1] : null;
  const type = m ? m[2] : null;
  const pick = (a: string | null, t: string | null) => onChange(a ? `${a}-arm ${t ?? "Medium"}` : "N/A");
  const known = BOWLING_STYLES.find((s) => s.value === value);
  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-jcc-blue/12 bg-jcc-navy-light p-1">
        {[null, "Right", "Left"].map((a) => (
          <button
            key={a ?? "none"}
            type="button"
            aria-pressed={arm === a}
            onClick={() => pick(a, type)}
            className={`rounded-lg py-2.5 text-xs font-black transition-all ${arm === a ? "bg-jcc-blue text-[#FFFFFF] shadow-sm" : "text-jcc-blue/70 hover:text-jcc-blue"}`}
          >
            {a ? `${a}-arm` : "Don't bowl"}
          </button>
        ))}
      </div>
      <div className={`grid grid-cols-2 gap-2 transition-opacity ${arm ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!arm}>
        {BOWL_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            disabled={!arm}
            aria-pressed={type === t.value}
            onClick={() => pick(arm, t.value)}
            className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-all ${type === t.value && arm ? "border-jcc-accent bg-jcc-accent/10" : "border-jcc-blue/12 hover:border-jcc-blue/30"}`}
          >
            <span className="text-xs font-black text-jcc-blue">{t.label}</span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-jcc-text-muted">{t.hint}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] font-semibold text-jcc-text-muted">{known ? known.label : value}</p>
    </div>
  );
}

interface Player {
  id: string;
  name: string;
  phone: string;
  cricket_role: "all-rounder" | "batter" | "bowler" | "wicketkeeper";
  batting_style: string;
  bowling_style: string;
  bio: string;
  image_url: string | null;
  image_focus?: PhotoFocus | null;
  team: string;
  member_tag: string;
  group_role: string;
  governance_role: string | null;
  is_core_committee: boolean;
  is_exec_committee: boolean;
  approval_status: string;
}

// Why a Google sign-in came back without a session (?login_error= from
// app/api/player/google/callback).
const GOOGLE_LOGIN_ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. Enter your number to try again.",
  expired: "That sign-in took too long or was opened in another browser. Please try again.",
  google: "Google couldn't confirm your account. Please try again.",
  inactive: "Your membership is pending admin approval or has been deactivated. Please contact JCC Support.",
  other_account:
    "This number is linked to a different Google account. Sign in with that account, or ask an admin to reset the link.",
  account_in_use:
    "This Google account is already linked to another member. Use a different Google account, or ask an admin.",
  server: "Something went wrong signing you in. Please try again.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 rounded-full bg-white p-[2px]">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export default function ProfilePage() {
  // Session & UI Phase states
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [verifiedPlayer, setVerifiedPlayer] = useState<Player | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [tab, setTab] = useState<"overview" | "edit">("overview");

  // Authentication Flow States
  const [phone, setPhone] = useState("");

  // Form Field States
  const [name, setName] = useState("");
  const [cricketRole, setCricketRole] = useState<Player["cricket_role"]>("all-rounder");
  const [battingStyle, setBattingStyle] = useState("Right-hand Bat");
  const [bowlingStyle, setBowlingStyle] = useState("N/A");
  const [bio, setBio] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFocus, setImageFocus] = useState<PhotoFocus | null>(null);
  const [framing, setFraming] = useState(false);
  const [savingFraming, setSavingFraming] = useState(false);

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
  const [signupFocus, setSignupFocus] = useState<PhotoFocus | null>(null);
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

  // Back from Google — trade the handoff cookie for a session
  const completeGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/player/google/complete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed. Please try again.");

      // Save tokens & hydrate
      localStorage.setItem("jcc_verified_session", data.sessionToken);
      localStorage.setItem("jcc_verified_player", JSON.stringify(data.player));
      window.dispatchEvent(new Event("jcc-member"));

      setSessionToken(data.sessionToken);
      setVerifiedPlayer(data.player);

      setName(data.player.name);
      setCricketRole(data.player.cricket_role);
      setBattingStyle(data.player.batting_style || "Right-hand Bat");
      setBowlingStyle(data.player.bowling_style || "N/A");
      setBio(data.player.bio || "");
      setImageUrl(data.player.image_url);
      setImageFocus(parseFocus(data.player.image_focus));

      setPhone("");
      setSuccessMsg("Signed in. Welcome to your profile board.");

      // Every login lands on the profile overview, wherever it started.
      setTab("overview");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setPortalMode("login");
      setErrorMsg(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load session from localStorage on mount
  useEffect(() => {
    // Back from Google (app/api/player/google/callback): finish signing in, or
    // say why it didn't work. Either way, tidy the URL.
    const params = new URLSearchParams(window.location.search);
    const loginResult = params.get("login");
    const loginError = params.get("login_error");
    if (loginResult || loginError) window.history.replaceState(null, "", "/profile");
    if (loginError) {
      setPortalMode("login");
      setErrorMsg(GOOGLE_LOGIN_ERRORS[loginError] ?? GOOGLE_LOGIN_ERRORS.server);
    } else if (loginResult === "google") {
      setPortalMode("login");
      setIsInitializing(false);
      completeGoogleLogin();
      return;
    }

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
        setImageFocus(parseFocus(parsedPlayer.image_focus));

        // Logins from before the member pass existed don't have one; mint it
        // from the saved session so /stats and My Stats work without signing in again.
        // Then replace the saved copy with the current record: it was stored
        // at login and goes stale (an old season's captaincy, a team move).
        fetch("/api/player/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: savedToken }),
        })
          .catch(() => {})
          .then(() => fetch("/api/player/me"))
          .then((res) => (res && res.ok ? res.json() : null))
          .then((data) => {
            if (!data?.player) return;
            setVerifiedPlayer((prev) => (prev ? { ...prev, ...data.player } : data.player));
            localStorage.setItem("jcc_verified_player", JSON.stringify({ ...parsedPlayer, ...data.player }));
            window.dispatchEvent(new Event("jcc-member"));
          })
          .catch(() => {});
      } catch (err) {
        // Clear corrupt data
        localStorage.removeItem("jcc_verified_session");
        localStorage.removeItem("jcc_verified_player");
        window.dispatchEvent(new Event("jcc-member"));
      }
    }
    setIsInitializing(false);
  }, []);

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
        setSignupFocus(null);
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
    setSignupFocus(null);
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

      let imageUrl = null;
      if (signupAvatarFile) {
        setSignupUploadStage("uploading");
        setSignupUploadProgress(0);
        imageUrl = await signupUploadWithProgress(signupAvatarFile, setSignupUploadProgress);
        setSignupUploadStage("saving");
      }

      // app/api/player/signup also catches a number that is already a member
      // or already waiting for approval.
      const res = await fetch("/api/player/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupFormData.name.trim(),
          phone: signupFormData.phone.trim(),
          cricket_role: signupFormData.cricket_role,
          image_url: imageUrl,
          image_focus: imageUrl ? signupFocus : null,
        }),
      });
      if (res.status === 409) {
        setSignupError("You are already an approved member. Please use the Login tab.");
        setSignupStatus("error");
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't send your request.");

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

  // 1. Action: check the phone number, then off to Google (lib/google-login.ts).
  // Coming back is handled by completeGoogleLogin, above.
  const handleGoogleLogin = async (e: React.FormEvent) => {
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
      const res = await fetch("/api/player/google/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone })
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start sign-in. Please try again.");
      // Leaves the page; isLoading stays on until Google takes over.
      window.location.assign(data.url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected network error occurred.");
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
      if (sessionToken) xhr.setRequestHeader("x-session-token", sessionToken);
      
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
      setImageFocus(null);
      setFraming(true);
      setUploadStage("done");
      setSuccessMsg("Photo uploaded. Check the framing below, then save.");
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
            image_url: imageUrl,
            image_focus: imageUrl ? imageFocus : null,
          }
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save profile changes.");
      }

      // Update local storage representation
      localStorage.setItem("jcc_verified_player", JSON.stringify(data.player));
      window.dispatchEvent(new Event("jcc-member"));
      setVerifiedPlayer(data.player);
      setSuccessMsg("Profile dossier successfully updated!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to persist profile modifications.");
    } finally {
      setIsSaving(false);
    }
  };

  // Saves the photo and its framing on their own, from the framing panel.
  const saveFraming = async () => {
    if (!sessionToken || !imageUrl) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      setSavingFraming(true);
      const res = await fetch("/api/player/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, updates: { image_url: imageUrl, image_focus: imageFocus } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save your photo.");
      localStorage.setItem("jcc_verified_player", JSON.stringify(data.player));
      window.dispatchEvent(new Event("jcc-member"));
      setVerifiedPlayer(data.player);
      setFraming(false);
      setSuccessMsg("Photo saved.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save your photo.");
    } finally {
      setSavingFraming(false);
    }
  };

  // 5. Action: Logout / Flush session
  const handleLogout = () => {
    // Signing out here signs out of members-only pages too.
    fetch("/api/player/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("jcc_verified_session");
    localStorage.removeItem("jcc_verified_player");
    window.dispatchEvent(new Event("jcc-member"));
    
    setSessionToken(null);
    setVerifiedPlayer(null);
    setName("");
    setBio("");
    setImageUrl(null);
    setImageFocus(null);
    setFraming(false);
    
    setErrorMsg("");
    setSuccessMsg("");
    setPhone("");
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

  const displayRole = verifiedPlayer
    ? getDisplayRole(verifiedPlayer.member_tag, verifiedPlayer.group_role, verifiedPlayer.cricket_role)
    : "";
  const avatarSrc = verifiedPlayer ? imageUrl || getDiceBearUrl(name || verifiedPlayer.name, verifiedPlayer.team) : "";
  const fullName = verifiedPlayer ? name || verifiedPlayer.name : "";
  const [firstName, ...restParts] = fullName.trim().split(/\s+/);
  const restName = restParts.join(" ");
  const team = teamByName(verifiedPlayer?.team);
  const teamColor = team?.primary ?? "#D4AF37";

  const Alerts = (
    <AnimatePresence mode="wait">
      {errorMsg && (
        <motion.div
          key="err"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-start gap-3 rounded-2xl border border-jcc-danger/25 bg-jcc-danger/10 p-4 text-xs font-bold text-jcc-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}
      {successMsg && (
        <motion.div
          key="ok"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-start gap-3 rounded-2xl border border-jcc-green/25 bg-jcc-green/10 p-4 text-xs font-bold text-jcc-green"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Logged out: split entrance ────────────────────────────────────────────
  if (!verifiedPlayer) {
    return (
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* Left — what membership is */}
        <section className="theme-static-dark section-bg-royal relative overflow-hidden px-6 pb-16 page-top sm:px-12 lg:pb-24">
          <Jaali />
          <div className="pointer-events-none absolute -right-40 -top-40 h-120 w-120 rounded-full bg-jcc-accent/15 blur-[120px]" />
          <div className="relative mx-auto max-w-xl pt-6 lg:pt-16">
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${LABEL} inline-flex items-center gap-2 text-jcc-accent`}>
              <ShieldCheck className="h-3.5 w-3.5" /> Members only
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 font-heading text-[clamp(2.8rem,7vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.045em] text-white"
            >
              Your Circle.
              <br />
              <span className="text-gradient-cyan">Your record.</span>
            </motion.h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/70">
              Every innings, every wicket, every week — kept for the people who wear the JCC colours. Log in with
              your registered number, or ask to join.
            </p>
            <ul className="mt-10 space-y-4">
              {[
                { icon: BarChart3, title: "Your stats & badges", desc: "Runs, wickets, awards and every badge you've earned." },
                { icon: BookOpen, title: "The full stats page", desc: "Leaderboards, player cards and every scorecard." },
                { icon: UsersRound, title: "Your member card", desc: "Photo, role and bio on the Members wall." },
              ].map((f, i) => (
                <motion.li
                  key={f.title}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08 }}
                  className="flex items-start gap-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-jcc-accent/30 bg-jcc-accent/10">
                    <f.icon className="h-4 w-4 text-jcc-accent" />
                  </span>
                  <span className="pt-0.5">
                    <span className="block text-sm font-black text-white">{f.title}</span>
                    <span className="block text-xs text-white/70">{f.desc}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
            <dl className="mt-12 grid grid-cols-2 border-t border-white/15">
              <div className="py-5">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Members</dt>
                <dd className="mt-2 font-heading text-4xl font-bold tabular-nums text-white">{memberCount ?? "—"}</dd>
              </div>
              <div className="border-l border-white/15 py-5 pl-6">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Matches on record</dt>
                <dd className="mt-2 font-heading text-4xl font-bold tabular-nums text-white">{matchCount ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Right — the form */}
        <section className="flex items-start justify-center bg-jcc-navy-deep px-5 py-12 sm:px-10 lg:items-center lg:page-top lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            {/* Segmented control */}
            <div className="relative grid grid-cols-2 rounded-2xl bg-jcc-blue/[0.06] p-1">
              {(["login", "signup"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPortalMode(mode);
                    setErrorMsg("");
                    setSuccessMsg("");
                    if (mode === "login") {
                      setSignupStatus("idle");
                      setSignupError("");
                    }
                  }}
                  className={`relative rounded-xl py-3 text-[11px] font-black uppercase tracking-[0.18em] transition-colors ${
                    portalMode === mode ? "text-[#FFFFFF]" : "text-jcc-blue/70 hover:text-jcc-blue"
                  }`}
                >
                  {portalMode === mode && (
                    <motion.span layoutId="portal-seg" className="absolute inset-0 rounded-xl bg-jcc-blue shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                  )}
                  <span className="relative">{mode === "login" ? "Log in" : "Join the Circle"}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-4">{Alerts}</div>

            <div className="mt-6 rounded-3xl border border-jcc-blue/10 bg-jcc-navy p-7 shadow-[0_30px_80px_-40px_rgba(18,35,63,0.45)] sm:p-9">
              <AnimatePresence mode="wait">
                {portalMode === "login" ? (
                  <motion.form key="phone" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} onSubmit={handleGoogleLogin} className="space-y-6">
                    <div>
                      <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-jcc-blue">Welcome back.</h2>
                      <p className="mt-2 text-sm text-jcc-text-muted">
                        Enter your registered number, then sign in with Google. The first Google account you use stays linked to your number.
                      </p>
                    </div>
                    <label className="block">
                      <span className={FIELD_LABEL}>Phone number</span>
                      <span className="relative mt-2 block">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-jcc-blue/70">+91</span>
                        <input
                          type="tel"
                          required
                          inputMode="numeric"
                          autoComplete="tel-national"
                          placeholder="9988776655"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                          className={`${INPUT} pl-14 tracking-wide`}
                        />
                      </span>
                    </label>
                    <button type="submit" disabled={isLoading} className="btn-vibrant-blue w-full justify-center py-4">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
                      <span>{isLoading ? "Signing you in…" : "Continue with Google"}</span>
                    </button>
                  </motion.form>
                ) : signupStatus === "pending_approval" ? (
                  <motion.div key="pending" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 py-4 text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-jcc-accent text-[#FFFFFF] shadow-lg shadow-jcc-accent/40">
                      <Clock className="h-7 w-7" />
                    </span>
                    <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-jcc-blue">Request received.</h2>
                    <p className="text-sm leading-relaxed text-jcc-text-muted">
                      An admin will review your request. Once you&apos;re approved, log in with your phone number.
                    </p>
                    <button type="button" onClick={() => { setSignupStatus("idle"); setPortalMode("login"); }} className="text-[11px] font-black uppercase tracking-widest text-jcc-accent-dark hover:underline">
                      Back to log in
                    </button>
                  </motion.div>
                ) : (
                  <motion.form key="signup" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} onSubmit={handleSignup} className="space-y-5">
                    <div>
                      <h2 className="font-heading text-3xl font-bold tracking-[-0.03em] text-jcc-blue">Join the Circle.</h2>
                      <p className="mt-2 text-sm text-jcc-text-muted">Send your details — an admin approves every member.</p>
                    </div>

                    {/* Photo first: it's required, and it's the friendliest step */}
                    <div className="flex items-center gap-4">
                      <label className={`relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${signupAvatarPreview ? "border-transparent" : "border-jcc-blue/20 hover:border-jcc-accent"} ${isSignupOptimizing || isSubmittingSignup ? "pointer-events-none opacity-60" : ""}`}>
                        {isSignupOptimizing ? (
                          <Loader2 className="h-5 w-5 animate-spin text-jcc-accent-dark" />
                        ) : signupAvatarPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={signupAvatarPreview} alt="Your photo" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-6 w-6 text-jcc-blue/70" />
                        )}
                        <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" className="hidden" disabled={isSignupOptimizing || isSubmittingSignup} onChange={handleSignupFileChange} />
                      </label>
                      <div className="min-w-0 text-xs">
                        <p className="font-black text-jcc-blue">Profile photo <span className="text-jcc-danger">*</span></p>
                        <p className="mt-1 text-jcc-text-muted">JPG, PNG or WEBP, up to 10MB — we optimise it.</p>
                        {signupAvatarPreview && !isSignupOptimizing && (
                          <button type="button" onClick={handleRemoveSignupAvatar} className="mt-1.5 font-bold text-jcc-danger hover:underline">
                            Remove
                          </button>
                        )}
                        {signupAvatarError && <p className="mt-1.5 font-bold text-jcc-danger">{signupAvatarError}</p>}
                      </div>
                    </div>
                    {signupAvatarPreview && !isSignupOptimizing && (
                      <div className="rounded-2xl border border-jcc-blue/10 p-4">
                        <p className="mb-3 text-xs font-black text-jcc-blue">Frame your photo</p>
                        <PhotoFramer key={signupAvatarPreview} src={signupAvatarPreview} name={signupFormData.name} onChange={setSignupFocus} compact />
                      </div>
                    )}

                    <label className="block">
                      <span className={FIELD_LABEL}>Full name</span>
                      <input type="text" required autoComplete="name" placeholder="e.g. Rahul Sharma" value={signupFormData.name} onChange={(e) => setSignupFormData({ ...signupFormData, name: e.target.value })} className={`${INPUT} mt-2`} />
                    </label>
                    <label className="block">
                      <span className={FIELD_LABEL}>Phone number</span>
                      <span className="relative mt-2 block">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-jcc-blue/70">+91</span>
                        <input type="tel" required inputMode="numeric" placeholder="9988776655" value={signupFormData.phone} onChange={(e) => setSignupFormData({ ...signupFormData, phone: e.target.value.replace(/[^0-9+]/g, "") })} className={`${INPUT} pl-14 tracking-wide`} />
                      </span>
                    </label>
                    <div>
                      <span className={FIELD_LABEL}>Your role</span>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {CRICKET_ROLES.map((role) => {
                          const selected = signupFormData.cricket_role === role.value;
                          return (
                            <button
                              key={role.value}
                              type="button"
                              onClick={() => setSignupFormData({ ...signupFormData, cricket_role: role.value })}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-black transition-all ${selected ? "border-jcc-accent bg-jcc-accent/10 text-jcc-blue" : "border-jcc-blue/12 text-jcc-blue/75 hover:border-jcc-blue/30"}`}
                            >
                              <role.icon className={`h-4 w-4 ${selected ? "text-jcc-accent-dark" : "text-jcc-blue/70"}`} />
                              {role.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {signupStatus === "error" && signupError && (
                      <p className="flex items-center gap-2 text-xs font-bold text-jcc-danger">
                        <AlertCircle className="h-4 w-4 shrink-0" /> {signupError}
                      </p>
                    )}

                    <button type="submit" disabled={isSubmittingSignup} className="btn-vibrant-blue w-full justify-center py-4">
                      {isSubmittingSignup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span>
                        {!isSubmittingSignup
                          ? "Request membership"
                          : signupUploadStage === "uploading"
                            ? `Uploading… ${signupUploadProgress}%`
                            : signupUploadStage === "optimizing"
                              ? "Optimising photo…"
                              : "Sending…"}
                      </span>
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            <p className="mt-6 flex items-center justify-center gap-5 text-[10px] font-black uppercase tracking-[0.18em] text-jcc-blue/70">
              <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Google sign-in</span>
              <span className="flex items-center gap-1.5"><Award className="h-3 w-3" /> Approval only</span>
            </p>
          </motion.div>
        </section>
      </div>
    );
  }

  // ── Logged in: profile ────────────────────────────────────────────────────
  // The overview ends on its own full-bleed finale, straight into the footer.
  return (
    <div className={`min-h-screen bg-jcc-navy-deep ${tab === "edit" ? "pb-24" : ""}`}>
      {/* Hero: the member, big. Team-coloured light, the crest as a watermark,
          a tall portrait and the name set in two weights. */}
      <section className="theme-static-dark page-top relative overflow-hidden bg-[#0B1424]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(60% 90% at 12% 40%, ${teamColor}40, transparent 62%), radial-gradient(45% 60% at 100% 0%, rgba(212,175,55,0.16), transparent 60%)` }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-jcc-accent/50 to-transparent" />
        {team && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt="" aria-hidden className="pointer-events-none absolute -bottom-28 -right-24 h-[36rem] w-[36rem] select-none object-contain opacity-[0.07] grayscale" />
        )}

        <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-6 sm:px-8 sm:pt-10">
          {/* Account row */}
          <div className="flex items-center justify-between gap-4">
            <p className={`${LABEL} text-jcc-accent`}>My profile</p>
            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-xs text-white/75 sm:inline">+91 {verifiedPlayer.phone}</span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.04] px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:border-jcc-danger/70"
              >
                <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>

          <div className="mt-8 grid items-end gap-8 md:mt-10 md:grid-cols-[minmax(0,290px)_minmax(0,1fr)] md:gap-14">
            {/* Portrait — tap to change */}
            <motion.div
              initial={{ opacity: 0, y: 28, rotate: -2.5 }}
              animate={{ opacity: 1, y: 0, rotate: -2.5 }}
              whileHover={{ rotate: 0, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 140, damping: 16 }}
              className="relative mx-auto w-full max-w-[260px] md:max-w-none"
            >
              <div aria-hidden className="absolute -inset-4 rounded-[40px] opacity-70 blur-2xl" style={{ background: `${teamColor}66` }} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[30px] ring-2 ring-jcc-accent/60"
                aria-label="Change profile photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarSrc}
                  alt={fullName}
                  className="h-full w-full object-cover"
                  style={imageUrl ? focusStyle(imageFocus, 0.42, 0.8) : undefined}
                  onError={(e) => {
                    const fallback = getDiceBearUrl(fullName, verifiedPlayer.team);
                    if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                  }}
                />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0B1424] via-[#0B1424]/50 to-transparent" />
                {team && (
                  <span className="absolute bottom-4 left-4 flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={team.logo} alt="" className="h-9 w-9 object-contain" />
                    <span className="text-[13px] font-bold text-white">{team.name}</span>
                  </span>
                )}
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-6 w-6 text-white" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Change photo</span>
                </span>
                {uploadStage === "uploading" && (
                  <span className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
                    <span className="block h-full bg-jcc-accent transition-all" style={{ width: `${uploadProgress}%` }} />
                  </span>
                )}
              </button>
              {imageUrl && (
                <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFraming((f) => !f)}
                    className="rounded-full bg-jcc-accent px-3.5 py-1.5 text-[10.5px] font-black uppercase tracking-widest text-[#0B1424] transition-transform hover:scale-[1.04]"
                  >
                    {framing ? "Close framing" : "Frame photo"}
                  </button>
                  {imageFocus && imageFocus.w < SHARP_WIDTH && (
                    <span
                      title={`Your photo is small (${imageFocus.w}px). Upload a sharper one for full-size story cards.`}
                      className="rounded-full bg-amber-300/15 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-widest text-[#FCD983] ring-1 ring-amber-300/40"
                    >
                      Low-res · {imageFocus.w}px
                    </span>
                  )}
                </div>
              )}
            </motion.div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />

            {/* Name and the rest of them */}
            <div className="min-w-0 pb-2">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getBadgeStyle(displayRole)}`}>{displayRole}</span>
                {(verifiedPlayer.is_core_committee || verifiedPlayer.is_exec_committee) && (
                  <span className="rounded-full border border-jcc-accent/60 bg-[#0B1424] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-jcc-accent-highlight">
                    {verifiedPlayer.is_core_committee ? "Core Committee" : "Executive Committee"}
                    {verifiedPlayer.governance_role ? ` · ${getGovernanceRoleLabel(verifiedPlayer)}` : ""}
                  </span>
                )}
              </motion.div>
              <h1 className="mt-5 font-heading text-[clamp(3rem,8.5vw,6.75rem)] font-extrabold leading-[0.88] tracking-[-0.055em]">
                {[firstName, restName].filter(Boolean).map((part, i) => (
                  <span key={i} className="block overflow-hidden pb-[0.06em]">
                    <motion.span
                      className="block"
                      initial={{ y: "105%" }}
                      animate={{ y: 0 }}
                      transition={{ delay: 0.15 + i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      style={i === 1 ? { color: "transparent", WebkitTextStroke: "1.5px rgba(255,255,255,0.9)" } : { color: "#FFFFFF" }}
                    >
                      {part}
                    </motion.span>
                  </span>
                ))}
              </h1>
              {bio && <p className="mt-6 max-w-xl text-lg italic leading-relaxed text-white/80">&ldquo;{bio}&rdquo;</p>}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {[battingStyle, bowlingStyle].filter((x) => x && x !== "N/A").map((x) => (
                  <span key={x} className="rounded-full border border-white/20 bg-white/[0.05] px-3.5 py-1.5 text-[12.5px] font-semibold text-white">{x}</span>
                ))}
              </div>
              {uploadStage !== "idle" && uploadStage !== "done" && (
                <p className="mt-3 text-[11px] font-bold text-jcc-accent">
                  {uploadStage === "optimizing" && "Optimising photo…"}
                  {uploadStage === "uploading" && `Uploading photo… ${uploadProgress}%`}
                  {uploadStage === "saving" && "Saving…"}
                  {uploadStage === "error" && "Photo upload failed."}
                </p>
              )}
            </div>
          </div>

          {/* View switch */}
          <div className="mt-10 inline-flex rounded-full bg-white/[0.06] p-1 ring-1 ring-white/15">
            {(["overview", "edit"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative rounded-full px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition-colors ${tab === t ? "text-[#0B1424]" : "text-white/80 hover:text-white"}`}
              >
                {tab === t && <motion.span layoutId="profile-tab" className="absolute inset-0 rounded-full bg-jcc-accent" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />}
                <span className="relative">{t === "overview" ? "My story" : "Edit profile"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Framing and notices sit in the page column; the story below runs full width. */}
      <div className="mx-auto max-w-6xl space-y-6 px-5 pt-8 sm:px-8 [&:empty]:hidden">
        {framing && imageUrl && (
          <section className="rounded-3xl border border-jcc-blue/10 bg-jcc-navy p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-jcc-accent-dark">Your photo</p>
                <h2 className="mt-1 font-heading text-2xl font-bold tracking-[-0.03em] text-jcc-blue">Frame your photo</h2>
                <p className="mt-1 text-sm text-jcc-text-muted">Your avatar and story cards centre on the circle.</p>
              </div>
              <button
                type="button"
                onClick={saveFraming}
                disabled={savingFraming || !imageFocus}
                className="btn-vibrant-blue disabled:opacity-50"
              >
                {savingFraming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save photo
              </button>
            </div>
            <PhotoFramer key={imageUrl} src={imageUrl} name={name || verifiedPlayer.name} initial={imageFocus} onChange={setImageFocus} />
          </section>
        )}
        {Alerts}
      </div>
      <AnimatePresence mode="wait">
          {tab === "overview" ? (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MyStats key={verifiedPlayer.id} photo={imageUrl ? withFocus(imageUrl, imageFocus) : null} />
            </motion.div>
          ) : (
            <motion.form key="edit" onSubmit={handleSaveProfile} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mx-auto mt-8 w-[calc(100%-2.5rem)] max-w-6xl rounded-3xl border border-jcc-blue/10 bg-jcc-navy p-6 sm:w-[calc(100%-4rem)] sm:p-10">
              <div className="grid gap-8 lg:grid-cols-2">
                <label className="block lg:col-span-2">
                  <span className={FIELD_LABEL}>Display name</span>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={`${INPUT} mt-2`} />
                </label>

                <div className="lg:col-span-2">
                  <span className={FIELD_LABEL}>Role</span>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CRICKET_ROLES.map((role) => {
                      const selected = cricketRole === role.value;
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => setCricketRole(role.value as Player["cricket_role"])}
                          className={`rounded-2xl border p-4 text-left transition-all ${selected ? "border-jcc-accent bg-jcc-accent/10" : "border-jcc-blue/12 hover:border-jcc-blue/30"}`}
                        >
                          <role.icon className={`h-5 w-5 ${selected ? "text-jcc-accent-dark" : "text-jcc-blue/70"}`} />
                          <p className="mt-3 text-sm font-black text-jcc-blue">{role.label}</p>
                          <p className="mt-1 text-[11px] leading-snug text-jcc-text-muted">{role.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className={FIELD_LABEL}>Batting</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {BATTING_STYLES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setBattingStyle(s.value)}
                        className={`rounded-xl border py-3 text-xs font-black transition-all ${battingStyle === s.value ? "border-jcc-accent bg-jcc-accent/10 text-jcc-blue" : "border-jcc-blue/12 text-jcc-blue/75 hover:border-jcc-blue/30"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className={FIELD_LABEL}>Bowling</span>
                  <BowlingPicker value={bowlingStyle} onChange={setBowlingStyle} />
                </div>

                <label className="block lg:col-span-2">
                  <span className="flex items-center justify-between">
                    <span className={FIELD_LABEL}>Bio</span>
                    <span className={`text-[10px] font-bold ${bio.length > 250 ? "text-jcc-danger" : "text-jcc-text-muted"}`}>{bio.length} / 300</span>
                  </span>
                  <textarea
                    maxLength={300}
                    rows={4}
                    placeholder="Your cricket story — favourite position, signature shot, best JCC moment…"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className={`${INPUT} mt-2 resize-none`}
                  />
                </label>
              </div>

              <div className="mt-8 flex flex-col-reverse items-stretch gap-3 border-t border-jcc-blue/10 pt-6 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" onClick={() => setTab("overview")} className="rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-widest text-jcc-blue/75 hover:text-jcc-blue">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="btn-vibrant-blue justify-center px-8 py-3.5 text-xs">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{isSaving ? "Saving…" : "Save profile"}</span>
                </button>
              </div>
            </motion.form>
          )}
      </AnimatePresence>
    </div>
  );
}
