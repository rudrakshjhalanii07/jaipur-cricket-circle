"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  Users,
  ClipboardList,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Loader2,
  Newspaper,
  FileJson
} from "lucide-react";
import MatchControl from "@/components/admin/MatchControl";
import RegistrationControl from "@/components/admin/RegistrationControl";
import MemberRoleManagement from "@/components/admin/MemberRoleManagement";
import MemberControl from "@/components/admin/MemberControl";
import BoundaryBanterControl from "@/components/admin/BoundaryBanterControl";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { supabase } from "@/lib/supabase";
import { HONORARY_GOVERNANCE_MEMBERS } from "@/lib/member-role";

type AdminSection = "dashboard" | "match" | "registrations" | "members" | "roles" | "chewvana";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [committeeCount, setCommitteeCount] = useState<number | null>(null);
  const [seasonsPlayed, setSeasonsPlayed] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [membersRes, playersRes, seasonsRes] = await Promise.all([
        supabase.from("players").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
        supabase.from("players").select("is_core_committee, is_exec_committee").eq("approval_status", "approved"),
        supabase.from("rivalry_seasons").select("id", { count: "exact", head: true })
      ]);
      if (!membersRes.error) setMemberCount(membersRes.count ?? null);
      if (!playersRes.error) {
        const dbCommitteeCount = (playersRes.data || []).filter(
          (p) => p.is_core_committee || p.is_exec_committee
        ).length;
        setCommitteeCount(dbCommitteeCount + HONORARY_GOVERNANCE_MEMBERS.length);
      }
      if (!seasonsRes.error) setSeasonsPlayed(seasonsRes.count ?? null);
    })();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const stored = sessionStorage.getItem("jcc_admin_password");
      if (stored) {
        try {
          const res = await fetch("/api/admin/verify-password", {
            method: "POST",
            headers: { "x-admin-password": stored }
          });
          if (res.ok) {
            setIsAuthenticated(true);
            setPassword(stored);
          } else {
            sessionStorage.removeItem("jcc_admin_password");
            setIsAuthenticated(false);
          }
        } catch (e) {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/admin/verify-password", {
        method: "POST",
        headers: { "x-admin-password": password }
      });

      if (res.ok) {
        sessionStorage.setItem("jcc_admin_password", password);
        setIsAuthenticated(true);
        setError(false);
      } else {
        setError(true);
        setTimeout(() => setError(false), 2000);
      }
    } catch (e) {
      setError(true);
      setTimeout(() => setError(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("jcc_admin_password");
    setIsAuthenticated(false);
    setPassword("");
    setActiveSection("dashboard");
  };

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-jcc-navy-deep flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-jcc-accent" />
    </div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-32 pb-20 relative overflow-hidden hero-gradient flex items-center justify-center px-4">
        {/* Cinematic Background Elements */}
        <div className="absolute inset-0 stadium-glow opacity-50 z-0" />
        <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full relative z-10"
        >
          <div className="premium-card p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-jcc-accent to-jcc-accent" />

            <div className="w-20 h-20 rounded-3xl bg-jcc-navy-light border border-jcc-border flex items-center justify-center mx-auto mb-8 shadow-inner">
              <ShieldCheck className="w-9 h-9 text-jcc-accent" />
            </div>

            <h1 className="text-3xl font-black text-jcc-blue font-[var(--font-heading)] mb-3 tracking-tight uppercase">Admin</h1>
            <p className="text-[13px] text-jcc-text-muted mb-10 font-medium leading-relaxed uppercase tracking-widest">Control Center</p>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative">
                <input
                  type="password"
                  placeholder="Passcode"
                  disabled={loading}
                  className={`w-full px-5 py-5 rounded-2xl bg-jcc-navy-light border outline-none transition-all text-center text-2xl font-black tracking-[0.5em] placeholder:tracking-normal placeholder:text-jcc-text-muted/40 text-jcc-blue ${
                    error
                      ? "border-jcc-danger ring-4 ring-jcc-danger/10 bg-jcc-danger/5"
                      : "border-jcc-border focus:border-jcc-accent ring-4 ring-jcc-accent/5 focus:bg-jcc-accent/5"
                  }`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute -bottom-7 left-0 right-0 text-[10px] text-jcc-danger font-black uppercase tracking-widest"
                    >
                      Access Denied • Check Passcode
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 rounded-2xl btn-vibrant-blue font-black text-sm transition-all duration-500 flex items-center justify-center gap-3 group relative overflow-hidden disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span className="relative z-10 uppercase tracking-widest">Sign In</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center mt-8 text-[11px] text-jcc-text-muted font-black uppercase tracking-[0.3em]">
            Jaipur Cricket Circle
          </p>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "match", label: "Match Control", icon: Settings },
    { id: "registrations", label: "Registrations", icon: ClipboardList },
    { id: "members", label: "Members", icon: Users },
    { id: "roles", label: "Member Roles", icon: ShieldCheck },
    { id: "chewvana", label: "Boundary Banter", icon: Newspaper },
  ];

  const externalLinks = [
    { href: "/admin/series-import", label: "Series Import", icon: FileJson },
  ];

  return (
    <div className="min-h-screen pt-36 pb-20 relative overflow-hidden hero-gradient">
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 stadium-glow opacity-50 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar — floating luxury navigation rail */}
          <aside className="lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-28 premium-card p-3 space-y-1 border-jcc-border-bright">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as AdminSection)}
                    className={`admin-nav-item w-full flex items-center gap-3 px-5 py-3.5 text-[12px] font-black uppercase tracking-widest ${
                      isActive
                        ? "admin-nav-item--active bg-jcc-accent text-white shadow-lg shadow-jcc-accent/25 scale-[1.02]"
                        : "text-jcc-blue/70 hover:text-jcc-blue"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? "text-white" : "text-jcc-accent-dark"}`} strokeWidth={1.5} />
                    {item.label}
                    {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto" strokeWidth={1.5} />}
                  </button>
                );
              })}
              <div className="pt-3 mt-3 border-t border-jcc-border-bright space-y-1">
                {externalLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="admin-nav-item w-full flex items-center gap-3 px-5 py-3.5 text-[12px] font-black uppercase tracking-widest text-jcc-blue/70 hover:text-jcc-blue"
                  >
                    <link.icon className="w-4 h-4 text-jcc-accent-dark" strokeWidth={1.5} />
                    {link.label}
                    <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-40" strokeWidth={1.5} />
                  </a>
                ))}
              </div>
              <div className="pt-3 border-t border-jcc-border-bright">
                <button
                  onClick={handleLogout}
                  className="admin-nav-item w-full flex items-center gap-3 px-5 py-3 text-[11px] font-black text-jcc-danger hover:bg-jcc-danger/5 uppercase tracking-widest"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* Content Area */}
          <main className="flex-1 min-w-0 w-full overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {activeSection === "dashboard" && (
                  <div className="space-y-12">
                    <AdminPageHeader title="Dashboard" subtitle="Circle Administration" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <AdminStatCard label="Seasons Played" value={seasonsPlayed} sub="Rivalry seasons" icon={Newspaper} />
                      <AdminStatCard label="Members" value={memberCount} sub="Approved players" icon={Users} />
                      <AdminStatCard label="Roles" value={committeeCount} sub="Committee members" icon={ShieldCheck} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <button
                        onClick={() => setActiveSection("match")}
                        className="premium-card p-10 text-left hover:border-jcc-accent/40 group transition-all duration-500 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-jcc-accent/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-jcc-accent/10 transition-all" />
                        <div className="w-14 h-14 rounded-2xl bg-jcc-accent/10 border border-jcc-accent/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-all shadow-inner">
                          <Settings className="w-7 h-7 text-jcc-accent-dark" />
                        </div>
                        <h3 className="text-2xl font-black text-jcc-blue mb-3 uppercase tracking-tight">Match Setup</h3>
                        <p className="text-[15px] text-jcc-text-muted font-medium leading-relaxed">Configure venue, schedule, and player capacity for the next fixture.</p>
                      </button>
                      <button
                        onClick={() => setActiveSection("registrations")}
                        className="premium-card p-10 text-left hover:border-jcc-accent/40 group transition-all duration-500 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-jcc-accent/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-jcc-accent/10 transition-all" />
                        <div className="w-14 h-14 rounded-2xl bg-jcc-accent/10 border border-jcc-accent/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-all shadow-inner">
                          <ClipboardList className="w-7 h-7 text-jcc-accent-dark" />
                        </div>
                        <h3 className="text-2xl font-black text-jcc-blue mb-3 uppercase tracking-tight">Registrations</h3>
                        <p className="text-[15px] text-jcc-text-muted font-medium leading-relaxed">Approve, waitlist, and manage player registrations for upcoming matches.</p>
                      </button>
                      <a
                        href="/admin/series-import"
                        className="premium-card p-10 text-left hover:border-jcc-accent-dark/40 group transition-all duration-500 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-jcc-accent-dark/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-jcc-accent-dark/10 transition-all" />
                        <div className="w-14 h-14 rounded-2xl bg-jcc-accent-dark/10 border border-jcc-accent-dark/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-all shadow-inner">
                          <FileJson className="w-7 h-7 text-jcc-accent-dark" />
                        </div>
                        <h3 className="text-2xl font-black text-jcc-blue mb-3 uppercase tracking-tight">Series Import</h3>
                        <p className="text-[15px] text-jcc-text-muted font-medium leading-relaxed">Import match scorecards via JSON — batting, bowling, and fall of wickets.</p>
                      </a>
                    </div>
                  </div>
                )}

                {activeSection === "match" && <MatchControl adminPassword={password} />}
                {activeSection === "registrations" && <RegistrationControl adminPassword={password} />}
                {activeSection === "members" && <MemberControl adminPassword={password} />}
                {activeSection === "roles" && <MemberRoleManagement adminPassword={password} />}
                {activeSection === "chewvana" && <BoundaryBanterControl adminPassword={password} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
