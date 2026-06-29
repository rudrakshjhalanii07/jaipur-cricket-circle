"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { fadeDown } from "@/lib/animations";
import LiveTicker from "./LiveTicker";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/chewvana-times", label: "Chewvana Times" },
  { href: "/members", label: "Members" },
  { href: "/rivalry", label: "Rivalry" },
  { href: "/tournament", label: "Tournament" },
  { href: "/register", label: "Register" },
  { href: "/profile", label: "Profile" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav 
      variants={fadeDown}
      initial="hidden"
      animate="visible"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-jcc-navy/80 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)]" : "bg-jcc-navy/70 backdrop-blur-md"}`}
    >
      <LiveTicker isNavbarScrolled={scrolled} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover:border-jcc-accent/40 group-hover:bg-white/[0.1] transition-all duration-300 overflow-hidden p-1.5">
              <img src="/jcc-logo.webp" alt="JCC Logo" width={96} height={96} fetchPriority="high" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-wider uppercase" style={{ fontFamily: "var(--font-wordmark)" }}>Jaipur Cricket Circle</span>
              <span className="text-[8px] text-white/50 tracking-[0.25em] uppercase leading-none font-bold">Est. 2026</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={`relative px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 rounded-xl group ${isActive ? "text-jcc-accent" : "text-white/40 hover:text-white"}`}>
                  <span className="relative z-10">{link.label}</span>
                  {isActive && (
                    <motion.span 
                      layoutId="nav-active-pill" 
                      className="absolute inset-0 bg-jcc-accent/5 border border-jcc-accent/20 rounded-xl -z-10 shadow-[0_0_20px_rgba(0,194,255,0.1)]" 
                      transition={{ type: "spring", stiffness: 400, damping: 30 }} 
                    />
                  )}
                  {!isActive && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-px bg-jcc-accent group-hover:w-4 transition-all duration-300" />
                  )}
                </Link>
              );
            })}
          </div>
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 text-white/70 hover:text-white transition-colors" aria-label="Toggle menu">
            <AnimatePresence mode="wait" initial={false}>
              {isOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}><X className="w-5 h-5" /></motion.div>
              ) : (
                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}><Menu className="w-5 h-5" /></motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="md:hidden overflow-hidden bg-jcc-navy/95 backdrop-blur-2xl border-b border-white/10">
            <div className="px-4 py-6 space-y-1">
              {navLinks.map((link, i) => {
                const isActive = pathname === link.href;
                return (
                  <motion.div key={link.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
                    <Link href={link.href} onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-4 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-200 ${isActive ? "text-jcc-accent bg-white/[0.05] border border-white/10" : "text-white/60 hover:text-white hover:bg-white/[0.03]"}`}>
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
