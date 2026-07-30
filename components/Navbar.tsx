"use client";

import { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { fadeDown } from "@/lib/animations";
import LiveTicker, { type TickerMatch } from "./LiveTicker";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/members", label: "Members" },
  { href: "/boundary-banter", label: "Boundary Banter" },
  { href: "/seasons", label: "Seasons" },
  { href: "/about", label: "About" },
];

const menuLinks = [
  { href: "/toss", label: "Toss" },
  { href: "/register", label: "Register" },
  { href: "/profile", label: "Profile" },
];

export default function Navbar({ nextMatch }: { nextMatch: TickerMatch | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  const focusVisibleTrigger = () => {
    const desktop = desktopTriggerRef.current;
    const mobile = mobileTriggerRef.current;
    if (desktop && desktop.offsetParent !== null) desktop.focus();
    else if (mobile && mobile.offsetParent !== null) mobile.focus();
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close whenever the route changes.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Escape to close + return focus to the trigger.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        focusVisibleTrigger();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Click/tap outside to close.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        desktopTriggerRef.current?.contains(target) ||
        mobileTriggerRef.current?.contains(target)
      ) return;
      setIsOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  // Lock body scroll while the panel is open.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const isMenuActive = menuLinks.some((link) => link.href === pathname);

  return (
    <motion.nav
      variants={fadeDown}
      initial="hidden"
      animate="visible"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${scrolled ? "bg-jcc-navy/90 backdrop-blur-xl border-jcc-accent/30 shadow-[0_4px_24px_rgba(18,35,63,0.08)]" : "bg-jcc-navy border-jcc-accent/15"}`}
    >
      <LiveTicker match={nextMatch} isNavbarScrolled={scrolled} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/jcc_logo.png" alt="JCC Logo" width={96} height={96} fetchPriority="high" className="w-14 h-14 sm:w-16 sm:h-16 object-contain group-hover:scale-110 transition-transform duration-300" />
            <div className="flex flex-col">
              <span className="text-sm font-bold italic text-white tracking-wider uppercase" style={{ fontFamily: "var(--font-heading)" }}>Jaipur Cricket Circle</span>
              <span className="text-[10px] text-white/65 tracking-[0.25em] uppercase leading-none font-bold">Est. 2026</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center flex-1 justify-evenly mx-6 lg:mx-10">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={`relative px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.3em] transition-all duration-300 rounded-xl group ${isActive ? "text-jcc-accent" : "text-white/60 hover:text-white"}`}>
                  <span className="relative z-10">{link.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 bg-jcc-accent/5 border border-jcc-accent/20 rounded-xl -z-10 shadow-[0_0_20px_rgba(212,175,55,0.15)]"
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

          <div className="hidden md:flex items-center">
            <button
              ref={desktopTriggerRef}
              onClick={() => setIsOpen((prev) => !prev)}
              aria-expanded={isOpen}
              aria-controls={menuId}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-300 ${isOpen || isMenuActive ? "text-jcc-accent bg-jcc-accent/5 border-jcc-accent/20" : "text-white/60 hover:text-white border-white/10 hover:border-white/20"}`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isOpen ? (
                  <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}><X className="w-5 h-5" /></motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}><Menu className="w-5 h-5" /></motion.div>
                )}
              </AnimatePresence>
              {isMenuActive && !isOpen && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-jcc-accent shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
              )}
            </button>
          </div>

          <button
            ref={mobileTriggerRef}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-controls={menuId}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            className="md:hidden relative p-2 text-white/70 hover:text-white transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              {isOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}><X className="w-5 h-5" /></motion.div>
              ) : (
                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}><Menu className="w-5 h-5" /></motion.div>
              )}
            </AnimatePresence>
            {isMenuActive && !isOpen && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-jcc-accent shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={menuId}
            ref={panelRef}
            role="menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full md:inset-x-auto md:right-4 lg:right-8 md:top-[calc(100%+0.5rem)] md:w-80 bg-jcc-navy/98 md:bg-jcc-navy backdrop-blur-2xl border-b md:border border-white/10 md:rounded-2xl md:shadow-[0_16px_48px_-8px_rgba(18,35,63,0.25)] max-h-[calc(100vh-4rem)] overflow-y-auto"
          >
            <div className="px-4 py-6 md:p-3 space-y-1">
              {/* Primary links duplicate here only for small screens, where the top bar hides them. */}
              <div className="md:hidden space-y-1 pb-3 mb-3 border-b border-white/10">
                {navLinks.map((link, i) => {
                  const isActive = pathname === link.href;
                  return (
                    <motion.div key={link.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03, duration: 0.3 }}>
                      <Link href={link.href} role="menuitem" onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-4 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-200 ${isActive ? "text-jcc-accent bg-white/[0.05] border border-white/10" : "text-white/60 hover:text-white hover:bg-white/[0.03]"}`}>
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {menuLinks.map((link, i) => {
                const isActive = pathname === link.href;
                return (
                  <motion.div key={link.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (i + navLinks.length) * 0.03, duration: 0.3 }}>
                    <Link href={link.href} role="menuitem" onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-4 md:py-3 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-200 ${isActive ? "text-jcc-accent bg-jcc-accent/5 border border-jcc-accent/20" : "text-white/60 hover:text-white hover:bg-white/[0.03]"}`}>
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
