"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/chewvana-times", label: "Chewvana Times" },
  { href: "/members", label: "Members" },
  { href: "/rivalry", label: "Rivalry" },
  { href: "/register", label: "Register" },
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
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-white/80 backdrop-blur-xl border-b border-jcc-border shadow-[0_4px_20px_rgba(16,42,67,0.04)]" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 rounded-lg bg-jcc-blue/[0.1] border border-jcc-blue/20 flex items-center justify-center group-hover:border-jcc-blue/40 group-hover:bg-jcc-blue/[0.15] transition-all duration-300">
              <span className="text-xs font-bold text-jcc-blue">⬡</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-jcc-navy tracking-wider font-[var(--font-heading)]">JCC</span>
              <span className="text-[8px] text-jcc-muted tracking-[0.25em] uppercase leading-none">Cricket Circle</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={`relative px-4 py-2 text-[13px] font-medium transition-all duration-300 rounded-lg group ${isActive ? "text-jcc-blue-deep" : "text-jcc-muted hover:text-jcc-blue-deep"}`}>
                  {link.label}
                  <span className={`absolute bottom-0.5 left-4 right-4 h-0.5 transition-all duration-300 ${isActive ? "bg-jcc-blue opacity-100" : "bg-jcc-blue opacity-0 group-hover:opacity-30"}`} />
                  {isActive && (<motion.span layoutId="nav-active-dot" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-jcc-blue" transition={{ type: "spring", stiffness: 400, damping: 30 }} />)}
                </Link>
              );
            })}
          </div>
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 text-jcc-muted hover:text-jcc-navy transition-colors" aria-label="Toggle menu">
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
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="md:hidden overflow-hidden bg-white/95 backdrop-blur-xl border-b border-jcc-border">
            <div className="px-4 py-3 space-y-0.5">
              {navLinks.map((link, i) => {
                const isActive = pathname === link.href;
                return (
                  <motion.div key={link.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
                    <Link href={link.href} onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 ${isActive ? "text-jcc-blue-deep bg-jcc-blue/[0.08] border border-jcc-blue/10" : "text-jcc-muted hover:text-jcc-navy hover:bg-jcc-bg"}`}>
                      {isActive && (<span className="w-1.5 h-1.5 rounded-full bg-jcc-blue" />)}
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
