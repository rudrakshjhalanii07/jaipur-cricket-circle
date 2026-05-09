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
      <div className="min-h-screen pt-32 pb-20 bg-jcc-bg flex items-center justify-center noise-overlay px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="glass-card p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-jcc-blue to-jcc-turf" />
            
            <div className="w-20 h-20 rounded-3xl bg-jcc-blue/[0.06] border border-jcc-blue/15 flex items-center justify-center mx-auto mb-8 shadow-inner">
              <ShieldCheck className="w-9 h-9 text-jcc-blue-deep" />
            </div>
            
            <h1 className="text-2xl font-extrabold text-jcc-navy font-[var(--font-heading)] mb-3 tracking-tight">Circle Command</h1>
            <p className="text-[13px] text-jcc-muted mb-10 font-medium leading-relaxed">Secure administrative portal for Jaipur Cricket Circle.</p>
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="relative">
                <input 
                  type="password"
                  placeholder="Enter Circle Passcode"
                  disabled={loading}
                  className={`w-full px-5 py-4 rounded-2xl bg-jcc-bg border outline-none transition-all text-center text-xl font-bold tracking-[0.5em] focus:ring-8 ${
                    error 
                      ? "border-jcc-red ring-jcc-red/5 bg-jcc-red/[0.02]" 
                      : "border-jcc-border focus:border-jcc-blue ring-jcc-blue/5"
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
                      className="absolute -bottom-6 left-0 right-0 text-[10px] text-jcc-red font-bold uppercase tracking-widest"
                    >
                      Access Denied • Check Passcode
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4.5 rounded-2xl bg-jcc-navy text-white font-bold text-sm shadow-2xl shadow-jcc-navy/30 hover:bg-jcc-blue-deep transition-all duration-500 flex items-center justify-center gap-3 group relative overflow-hidden disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span className="relative z-10">Access Control Panel</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
                  </>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
            </form>
          </div>
          
          <p className="text-center mt-8 text-[11px] text-jcc-muted font-bold uppercase tracking-[0.2em] opacity-50">
            JCC ADMIN SYSTEM v2.0
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
    <div className="min-h-screen pt-28 pb-20 bg-jcc-bg noise-overlay">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <div className="glass-card p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as AdminSection)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[13px] font-bold transition-all duration-300 ${
                    activeSection === item.id 
                      ? "bg-jcc-blue-deep text-white shadow-lg shadow-jcc-blue/20" 
                      : "text-jcc-muted hover:text-jcc-navy hover:bg-jcc-bg"
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${activeSection === item.id ? "text-white" : "text-jcc-muted"}`} />
                  {item.label}
                  {activeSection === item.id && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                </button>
              ))}
              <div className="pt-4 mt-4 border-t border-jcc-border">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[12px] font-bold text-jcc-red hover:bg-jcc-red/5 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* Content Area */}
          <main className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {activeSection === "dashboard" && (
                  <div className="space-y-8">
                    <div>
                      <h1 className="text-3xl font-bold text-jcc-navy font-[var(--font-heading)] mb-2">Circle Command</h1>
                      <p className="text-[14px] text-jcc-muted font-medium">Welcome back, Admin. Select a section to manage the circle.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: "Matches", value: "24", sub: "Active Matches", color: "blue" },
                        { label: "Registered", value: "182", sub: "Total Signups", color: "turf" },
                        { label: "Committee", value: "5", sub: "Leaders", color: "purple" },
                      ].map((stat, i) => (
                        <div key={i} className="glass-card p-6">
                           <p className="text-[10px] font-bold text-jcc-muted uppercase tracking-widest mb-1">{stat.label}</p>
                           <h3 className="text-3xl font-bold text-jcc-navy mb-1">{stat.value}</h3>
                           <p className="text-[11px] text-jcc-muted font-medium">{stat.sub}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button 
                        onClick={() => setActiveSection("match")}
                        className="glass-card p-8 text-left hover:border-jcc-blue/30 group transition-all duration-300"
                      >
                         <div className="w-12 h-12 rounded-xl bg-jcc-blue/[0.06] border border-jcc-blue/15 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Settings className="w-6 h-6 text-jcc-blue" />
                         </div>
                         <h3 className="text-lg font-bold text-jcc-navy mb-2">Quick Match Setup</h3>
                         <p className="text-[13px] text-jcc-muted font-medium leading-relaxed">Update venue, time and player limits for this week's game.</p>
                      </button>
                      <button 
                        onClick={() => setActiveSection("registrations")}
                        className="glass-card p-8 text-left hover:border-jcc-turf/30 group transition-all duration-300"
                      >
                         <div className="w-12 h-12 rounded-xl bg-jcc-turf/[0.06] border border-jcc-turf/15 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <ClipboardList className="w-6 h-6 text-jcc-turf" />
                         </div>
                         <h3 className="text-lg font-bold text-jcc-navy mb-2">Manage Squad</h3>
                         <p className="text-[13px] text-jcc-muted font-medium leading-relaxed">View all registered players, remove entries or promote from waitlist.</p>
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
