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
  Lock,
  ArrowRight,
  Loader2,
  Newspaper
} from "lucide-react";
import MatchControl from "@/components/admin/MatchControl";
import RegistrationControl from "@/components/admin/RegistrationControl";
import MemberRoleManagement from "@/components/admin/MemberRoleManagement";
import MemberControl from "@/components/admin/MemberControl";
import ChewvanaControl from "@/components/admin/ChewvanaControl";

type AdminSection = "dashboard" | "match" | "registrations" | "members" | "roles" | "chewvana";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

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
    return <div className="min-h-screen bg-jcc-bg flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-jcc-blue" />
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
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-jcc-accent to-emerald-400" />
            
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8 shadow-inner">
              <ShieldCheck className="w-9 h-9 text-jcc-accent" />
            </div>
            
            <h1 className="text-3xl font-black text-white font-[var(--font-heading)] mb-3 tracking-tight uppercase">Circle Command</h1>
            <p className="text-[13px] text-white/50 mb-10 font-medium leading-relaxed uppercase tracking-widest">Administrative Control Center</p>
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative">
                <input 
                  type="password"
                  placeholder="Passcode"
                  disabled={loading}
                  className={`w-full px-5 py-5 rounded-2xl bg-black/40 border outline-none transition-all text-center text-2xl font-black tracking-[0.5em] placeholder:tracking-normal placeholder:text-white/10 text-white ${
                    error 
                      ? "border-jcc-ball-red ring-4 ring-jcc-ball-red/10 bg-jcc-ball-red/5" 
                      : "border-white/10 focus:border-jcc-accent ring-4 ring-jcc-accent/5 focus:bg-jcc-accent/5"
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
                      className="absolute -bottom-7 left-0 right-0 text-[10px] text-jcc-ball-red font-black uppercase tracking-widest"
                    >
                      Access Denied • Check Passcode
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-5 rounded-2xl btn-vibrant-blue text-black font-black text-sm transition-all duration-500 flex items-center justify-center gap-3 group relative overflow-hidden disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span className="relative z-10 uppercase tracking-widest">Access Control Panel</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
                  </>
                )}
              </button>
            </form>
          </div>
          
          <p className="text-center mt-8 text-[11px] text-white/20 font-black uppercase tracking-[0.3em]">
            JCC COMMAND SYSTEM v2.5
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
    { id: "chewvana", label: "Chewvana Times", icon: Newspaper },
  ];

  return (
    <div className="min-h-screen pt-36 pb-20 relative overflow-hidden hero-gradient">
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 stadium-glow opacity-50 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <div className="premium-card p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as AdminSection)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[13px] font-black transition-all duration-300 uppercase tracking-widest ${
                    activeSection === item.id 
                      ? "bg-jcc-accent text-black shadow-lg shadow-jcc-accent/20" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${activeSection === item.id ? "text-black" : "text-white/40"}`} />
                  {item.label}
                  {activeSection === item.id && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                </button>
              ))}
              <div className="pt-4 mt-4 border-t border-white/10">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black text-jcc-ball-red hover:bg-jcc-ball-red/5 transition-colors uppercase tracking-widest"
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
                    <div>
                      <h1 className="text-5xl font-black text-white font-[var(--font-heading)] mb-3 uppercase tracking-tighter">Circle Command</h1>
                      <p className="text-[13px] text-white/40 font-black uppercase tracking-[0.3em] ml-1">Central Tactical Hub • Operation Active</p>
                    </div>
 
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: "Tactical Engagements", value: "24", sub: "Matches Executed", color: "text-jcc-accent", border: "border-jcc-accent/20" },
                        { label: "Personnel Roster", value: "182", sub: "Active Warriors", color: "text-emerald-400", border: "border-emerald-400/20" },
                        { label: "Command Committee", value: "05", sub: "Decision Makers", color: "text-purple-400", border: "border-purple-400/20" },
                      ].map((stat, i) => (
                        <div key={i} className={`premium-card p-8 border ${stat.border} group hover:scale-[1.02] transition-all duration-500 shadow-2xl`}>
                           <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-4 group-hover:text-white/50 transition-colors">{stat.label}</p>
                           <h3 className={`text-5xl font-black ${stat.color} mb-2 font-[var(--font-heading)] tracking-tighter`}>{stat.value}</h3>
                           <p className="text-[11px] text-white/40 font-black uppercase tracking-widest">{stat.sub}</p>
                        </div>
                      ))}
                    </div>
 
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <button 
                        onClick={() => setActiveSection("match")}
                        className="premium-card p-10 text-left hover:border-jcc-accent/40 group transition-all duration-500 relative overflow-hidden shadow-2xl"
                      >
                         <div className="absolute top-0 right-0 w-32 h-32 bg-jcc-accent/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-jcc-accent/10 transition-all" />
                         <div className="w-14 h-14 rounded-2xl bg-jcc-accent/10 border border-jcc-accent/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-all shadow-inner">
                            <Settings className="w-7 h-7 text-jcc-accent" />
                         </div>
                         <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">Tactical Setup</h3>
                         <p className="text-[15px] text-white/40 font-medium leading-relaxed uppercase tracking-wide">Configure operational parameters: Venue, Schedule, and Personnel Capacity.</p>
                      </button>
                      <button 
                        onClick={() => setActiveSection("registrations")}
                        className="premium-card p-10 text-left hover:border-emerald-400/40 group transition-all duration-500 relative overflow-hidden shadow-2xl"
                      >
                         <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-400/10 transition-all" />
                         <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-all shadow-inner">
                            <ClipboardList className="w-7 h-7 text-emerald-400" />
                         </div>
                         <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">Squad Management</h3>
                         <p className="text-[15px] text-white/40 font-medium leading-relaxed uppercase tracking-wide">Authorize deployment, manage standby protocols, and verify personnel status.</p>
                      </button>
                    </div>
                  </div>
                )}

                {activeSection === "match" && <MatchControl adminPassword={password} />}
                {activeSection === "registrations" && <RegistrationControl adminPassword={password} />}
                {activeSection === "members" && <MemberControl adminPassword={password} />}
                {activeSection === "roles" && <MemberRoleManagement adminPassword={password} />}
                {activeSection === "chewvana" && <ChewvanaControl adminPassword={password} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
