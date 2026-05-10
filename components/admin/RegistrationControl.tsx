"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Trash2, ArrowUpCircle, Loader2, CheckCircle2, Wifi } from "lucide-react";
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

      setRegistrations(registrations.map(r => r.id === id ? { ...r, status: "confirmed" } : r));
    } catch (err) {
      console.error("Promotion error:", err);
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-jcc-accent opacity-20" /></div>;

  const confirmed = registrations.filter(r => r.status === "confirmed");
  const waitlist = registrations.filter(r => r.status === "waitlist");

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white font-[var(--font-heading)] uppercase tracking-tight">Match Roster</h2>
          <p className="text-[13px] text-white/50 font-medium uppercase tracking-widest mt-1">Squad & Standby Management</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center gap-2 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-black text-white uppercase tracking-widest">{confirmed.length} Confirmed</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-jcc-gold/10 border border-jcc-gold/20 flex items-center gap-2 shadow-lg">
            <Wifi className="w-4 h-4 text-jcc-gold" />
            <span className="text-[11px] font-black text-white uppercase tracking-widest">{waitlist.length} Waitlist</span>
          </div>
        </div>
      </div>

      <div className="premium-card overflow-hidden border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.25em]">Warrior</th>
                <th className="px-6 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.25em]">Comms</th>
                <th className="px-6 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.25em]">Specialization</th>
                <th className="px-6 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.25em]">Deployment</th>
                <th className="px-6 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.25em] text-right">Command</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {registrations.length > 0 ? registrations.map((player) => (
                <tr key={player.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5">
                    <span className="text-[15px] font-black text-white uppercase tracking-tight">{player.name}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[13px] text-white/40 font-black tracking-widest">{player.phone}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-black text-jcc-accent uppercase tracking-[0.15em]">{player.cricket_role}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border ${
                      player.status === "confirmed" 
                        ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/10" 
                        : "bg-jcc-gold/10 text-jcc-gold border-jcc-gold/10"
                    }`}>
                      {player.status === "confirmed" ? <CheckCircle2 className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                      {player.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {player.status === "waitlist" && (
                        <button
                          disabled={actionId === player.id}
                          onClick={() => promotePlayer(player.id)}
                          className="w-10 h-10 rounded-xl bg-jcc-accent/10 text-jcc-accent hover:bg-jcc-accent hover:text-black transition-all flex items-center justify-center shadow-inner border border-white/5"
                          title="Promote to Squad"
                        >
                          {actionId === player.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-5 h-5" />}
                        </button>
                      )}
                      <button
                        disabled={actionId === player.id}
                        onClick={() => deleteRegistration(player.id)}
                        className="w-10 h-10 rounded-xl bg-jcc-ball-red/10 text-jcc-ball-red hover:bg-jcc-ball-red hover:text-black transition-all flex items-center justify-center shadow-inner border border-white/5"
                        title="Remove Player"
                      >
                        {actionId === player.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-white/20 text-sm font-black uppercase tracking-[0.2em]">
                    No registrations detected for this match.
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
