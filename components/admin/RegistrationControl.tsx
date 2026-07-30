"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Trash2, ArrowUpCircle, Loader2, CheckCircle2, Wifi, ClipboardX } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminSkeleton from "@/components/admin/AdminSkeleton";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

interface PlayerRegistration {
  id: string;
  name: string;
  phone: string;
  cricket_role: string;
  status: string;
}

export default function RegistrationControl({ adminPassword }: { adminPassword?: string }) {
  const [registrations, setRegistrations] = useState<PlayerRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  async function fetchRegistrations() {
    try {
      // Get the latest match first
      const { data: matchData } = await supabase
        .from("matches")
        .select("id")
        .order("match_date", { ascending: false })
        .limit(1)
        .single();

      if (matchData) {
        const { data, error } = await supabase
          .from("registrations")
          .select("*")
          .eq("match_id", matchData.id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setRegistrations(data || []);
      }
    } catch (err) {
      console.error("Error fetching registrations:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRegistrations();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const deleteRegistration = async (id: string) => {
    if (!confirm("Are you sure you want to remove this player?")) return;
    setActionId(id);
    try {
      const response = await fetch("/api/admin/remove-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({ registration_id: id }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to remove player");
      }

      setRegistrations(registrations.filter(r => r.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setActionId(null);
    }
  };

  const promotePlayer = async (id: string) => {
    setActionId(id);
    try {
      const response = await fetch("/api/admin/promote-waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({ registration_id: id }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to promote player");
      }

      setRegistrations(registrations.map(r => r.id === id ? { ...r, status: "registered" } : r));
    } catch (err) {
      console.error("Promotion error:", err);
    } finally {
      setActionId(null);
    }
  };

  const confirmed = registrations.filter(r => r.status === "registered");
  const waitlist = registrations.filter(r => r.status === "waitlist");

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Match Roster" subtitle="Squad & Standby Management" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <AdminStatCard label="Registered" value={confirmed.length} sub="Confirmed for match day" icon={CheckCircle2} />
        <AdminStatCard label="Waitlist" value={waitlist.length} sub="Awaiting a spot" icon={Wifi} />
      </div>

      {loading ? (
        <AdminSkeleton rows={4} rowHeight="76px" />
      ) : registrations.length > 0 ? (
        <div className="space-y-3">
          {registrations.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.03, ease: [0.16, 1, 0.3, 1] }}
              className="premium-card px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-black text-jcc-blue uppercase tracking-tight truncate">{player.name}</p>
                <p className="text-[12px] text-jcc-text-muted font-bold tracking-widest mt-0.5">{player.phone}</p>
              </div>

              <span className="text-[10px] font-black text-jcc-accent-dark uppercase tracking-[0.15em] shrink-0">
                {player.cricket_role}
              </span>

              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border shrink-0 ${
                player.status === "registered"
                  ? "bg-jcc-accent/10 text-jcc-accent-dark border-jcc-accent/25"
                  : "bg-jcc-navy-light text-jcc-text-muted border-jcc-border-bright"
              }`}>
                {player.status === "registered" ? <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} /> : <Wifi className="w-3 h-3" strokeWidth={1.5} />}
                {player.status}
              </span>

              <div className="flex items-center justify-end gap-2 shrink-0">
                {player.status === "waitlist" && (
                  <button
                    disabled={actionId === player.id}
                    onClick={() => promotePlayer(player.id)}
                    className="btn-ghost px-3! py-2.5! text-[10px]!"
                    title="Promote to Squad"
                  >
                    {actionId === player.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" strokeWidth={1.5} />}
                    Promote
                  </button>
                )}
                <button
                  disabled={actionId === player.id}
                  onClick={() => deleteRegistration(player.id)}
                  className="admin-btn-destructive px-3! py-2.5! text-[10px]!"
                  title="Remove Player"
                >
                  {actionId === player.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="premium-card">
          <AdminEmptyState
            icon={ClipboardX}
            title="No registrations yet"
            description="Players who sign up for the next match will appear here."
          />
        </div>
      )}
    </div>
  );
}
