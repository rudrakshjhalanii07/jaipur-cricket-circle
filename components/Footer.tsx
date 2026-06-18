"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, VIEWPORT_CONFIG } from "@/lib/animations";

const quickLinks = [
  { href: "/chewvana-times", label: "Chewvana Times" },
  { href: "/members", label: "Members" },
  { href: "/rivalry", label: "Rivalry" },
  { href: "/register", label: "Sunday Registration" },
  { href: "/about", label: "About Us" },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-white/10 section-bg-navy">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jcc-accent/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16"
        >
          {/* Brand */}
          <motion.div variants={fadeUp} className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-inner group/logo transition-all hover:border-jcc-accent/40 hover:bg-white/5 overflow-hidden p-2.5">
                <img src="/jcc-logo.jpeg" alt="JCC Logo" className="w-full h-full object-contain group-hover/logo:scale-110 transition-transform duration-300" />
              </div>
              <div>
                <div className="text-[14px] font-black text-white tracking-[0.2em] uppercase font-[var(--font-heading)] leading-tight">
                  Jaipur Cricket Circle
                </div>
                <div className="text-[9px] text-white/30 tracking-[0.5em] uppercase font-black mt-1">
                  Established 2026
                </div>
              </div>
            </div>
            <p className="text-[14px] text-jcc-text-soft/60 leading-relaxed max-w-xs font-bold uppercase tracking-wider">
              Where Sundays Hit Different. A community of cricket lovers in
              Jaipur, playing hard and building bonds every weekend.
            </p>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={fadeUp} className="space-y-8">
            <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] opacity-50">
              Quick Links
            </h3>
            <ul className="space-y-4">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-white/50 hover:text-jcc-accent transition-all duration-300 font-black uppercase tracking-[0.15em] hover:tracking-[0.2em]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Connect */}
          <motion.div variants={fadeUp} className="space-y-8">
            <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] opacity-50">
              Connect
            </h3>
            <div className="space-y-4">
              <a
                href="https://chat.whatsapp.com/LtuFpx2EcKO4E5yZWP8aue?mode=gi_t"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 text-[13px] text-white/50 hover:text-[#25D366] transition-all duration-300 font-black uppercase tracking-[0.15em] hover:tracking-[0.2em] group/wa"
              >
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover/wa:border-[#25D366]/40 transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                WhatsApp Group
              </a>

            </div>
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={VIEWPORT_CONFIG}
          className="mt-14 pt-10 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-6">
            <p className="text-[11px] text-white/40 font-bold uppercase tracking-widest">
              &copy; {new Date().getFullYear()} Jaipur Cricket Circle.
            </p>
          </div>
          <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.2em]">
            Where Sundays Hit Different 🏏
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
