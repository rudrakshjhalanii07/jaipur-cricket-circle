"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Trash2, ArrowUpCircle, Loader2, CheckCircle2, Wifi, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RegistrationControl({ adminPassword }: { adminPassword?: string }) {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
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
  };

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

      setRegistrations(registrations.map(r => r.id === id ? { ...r, status: "confirmed" } : r));
    } catch (err) {
      console.error("Promotion error:", err);
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-jcc-blue" /></div>;

  const confirmed = registrations.filter(r => r.status === "confirmed");
  const waitlist = registrations.filter(r => r.status === "waitlist");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-jcc-navy font-[var(--font-heading)]">Registrations</h2>
          <p className="text-[12px] text-jcc-muted font-medium">Manage the squad and standby lists for the upcoming match.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-jcc-bg border border-jcc-border flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-jcc-turf" />
            <span className="text-[11px] font-bold text-jcc-navy">{confirmed.length} Confirmed</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-jcc-bg border border-jcc-border flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-jcc-gold" />
            <span className="text-[11px] font-bold text-jcc-navy">{waitlist.length} Waitlist</span>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-jcc-border bg-jcc-bg/30">
                <th className="px-6 py-4 text-[10px] font-bold text-jcc-muted uppercase tracking-widest">Player</th>
                <th className="px-6 py-4 text-[10px] font-bold text-jcc-muted uppercase tracking-widest">Phone</th>
                <th className="px-6 py-4 text-[10px] font-bold text-jcc-muted uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-[10px] font-bold text-jcc-muted uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-jcc-muted uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jcc-border">
              {registrations.length > 0 ? registrations.map((player) => (
                <tr key={player.id} className="hover:bg-jcc-bg/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-[13px] font-bold text-jcc-navy">{player.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[12px] text-jcc-muted font-mono">{player.phone}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-jcc-blue-deep uppercase tracking-widest">{player.cricket_role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      player.status === "confirmed" 
                        ? "bg-jcc-turf/[0.06] text-jcc-turf border border-jcc-turf/10" 
                        : "bg-jcc-gold/[0.06] text-jcc-gold border border-jcc-gold/10"
                    }`}>
                      {player.status === "confirmed" ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Wifi className="w-2.5 h-2.5" />}
                      {player.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {player.status === "waitlist" && (
                        <button
                          disabled={actionId === player.id}
                          onClick={() => promotePlayer(player.id)}
                          className="p-2 rounded-lg bg-jcc-blue/[0.06] text-jcc-blue-deep hover:bg-jcc-blue/[0.12] transition-colors"
                          title="Promote to Squad"
                        >
                          {actionId === player.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        disabled={actionId === player.id}
                        onClick={() => deleteRegistration(player.id)}
                        className="p-2 rounded-lg bg-jcc-red/[0.06] text-jcc-red hover:bg-jcc-red/[0.12] transition-colors"
                        title="Remove Player"
                      >
                        {actionId === player.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-jcc-muted text-sm font-medium">
                    No registrations found for this match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
