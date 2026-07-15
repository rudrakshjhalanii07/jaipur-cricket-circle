"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function FloatingWhatsApp() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      <motion.a
        href="https://chat.whatsapp.com/LtuFpx2EcKO4E5yZWP8aue?mode=gi_t"
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: expanded ? -2 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        whileTap={{ scale: 0.97 }}
        className="theme-static-dark relative flex items-center rounded-full bg-jcc-blue py-3 pl-3 pr-3 shadow-[0_6px_20px_rgba(18,35,63,0.28)] border transition-shadow duration-500 ease-out sm:py-3.5 sm:pl-3.5 sm:pr-3.5"
        style={{
          borderColor: expanded ? "var(--color-jcc-accent-highlight)" : "color-mix(in srgb, var(--color-jcc-accent) 40%, transparent)",
          boxShadow: expanded
            ? "0 10px 28px rgba(18,35,63,0.35)"
            : "0 6px 20px rgba(18,35,63,0.28)",
        }}
      >
        {/* Icon — official WhatsApp mark, untouched */}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center sm:h-7 sm:w-7">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#25D366] sm:h-6 sm:w-6">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </span>

        {/* Label — collapsed by default, expands on hover/focus */}
        <motion.span
          initial={false}
          animate={{
            maxWidth: expanded ? 160 : 0,
            opacity: expanded ? 1 : 0,
            paddingLeft: expanded ? 10 : 0,
          }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden whitespace-nowrap text-xs font-black uppercase tracking-[0.08em] text-white sm:text-sm"
        >
          Join the Circle
        </motion.span>
      </motion.a>
    </div>
  );
}
