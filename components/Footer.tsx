"use client";

// The closing band on every page: one last push to the stats, the links, and
// the club's name set as large as the screen allows, rising letter by letter
// as the footer scrolls in.

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { gsap, useGSAP, reduceMotion } from "@/components/motion/gsap";

const explore = [
  { href: "/stats", label: "Stats" },
  { href: "/members", label: "Members" },
  { href: "/boundary-banter", label: "Boundary Banter" },
  { href: "/about", label: "About" },
  { href: "/profile", label: "Profile" },
];
const WHATSAPP_URL = "https://chat.whatsapp.com/LtuFpx2EcKO4E5yZWP8aue?mode=gi_t";
const WORD = "JCC";

export default function Footer() {
  const root = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      if (reduceMotion()) return;
      const q = gsap.utils.selector(root);
      gsap.fromTo(
        q("[data-letter]"),
        { yPercent: 100 },
        { yPercent: 0, ease: "expo.out", stagger: 0.08, duration: 1.4, scrollTrigger: { trigger: q("[data-word]")[0], start: "top 95%", once: true } },
      );
      gsap.fromTo(q("[data-foot-rule]"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", duration: 1.6, ease: "expo.inOut", scrollTrigger: { trigger: root.current, start: "top 90%", once: true } });
    },
    { scope: root, dependencies: [pathname] },
  );

  return (
    <footer ref={root} className="theme-static-dark print-grain relative overflow-hidden bg-[#0B1424]">
      <div aria-hidden className="pitch-grid absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-[88rem] px-5 pt-20 md:px-10 md:pt-28">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="kicker text-jcc-accent">JCC Intelligence</p>
            <p className="mt-5 max-w-md font-heading text-4xl font-extrabold leading-[0.95] tracking-[-0.05em] text-white md:text-5xl">
              Every ball, counted. Every player, ranked.
            </p>
            <Link href="/stats" className="btn-gold group mt-8">
              Enter the stats
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
            </Link>
          </div>
          <nav aria-label="Footer">
            <p className="kicker text-white/45">Explore</p>
            <ul className="mt-5 space-y-2.5">
              {explore.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="group inline-flex items-center gap-2 font-heading text-2xl font-bold tracking-[-0.03em] text-white/80 transition-colors hover:text-jcc-accent">
                    {l.label}
                    <ArrowUpRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="kicker text-white/45">Connect</p>
            <ul className="mt-5 space-y-2.5">
              <li>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-heading text-2xl font-bold tracking-[-0.03em] text-white/80 transition-colors hover:text-[#25D366]">
                  WhatsApp group ↗
                </a>
              </li>
              <li>
                <a href="/documents/JCC_Community_Charter.pdf" target="_blank" rel="noopener noreferrer" className="font-heading text-2xl font-bold tracking-[-0.03em] text-white/80 transition-colors hover:text-jcc-accent">
                  Community Charter ↗
                </a>
              </li>
            </ul>
            <p className="mt-8 max-w-xs text-sm leading-relaxed text-white/50">A box cricket community in Jaipur. Weekly matches, four franchises, one circle.</p>
          </div>
        </div>

        <div className="relative mt-20 flex flex-wrap items-center justify-between gap-4 pt-6 md:mt-28">
          <span data-foot-rule aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/15" />
          <p className="kicker text-white/45">© {new Date().getFullYear()} Jaipur Cricket Circle · Est. 8 March 2026</p>
          <p className="kicker text-white/45">Where matchdays hit different</p>
        </div>
      </div>

      <div data-word aria-hidden className="relative mt-6 flex select-none justify-center overflow-hidden leading-[0.72]">
        {WORD.split("").map((ch, i) => (
          <span key={i} data-letter className="block font-heading text-[40vw] font-extrabold tracking-[-0.08em] text-gold-foil">
            {ch}
          </span>
        ))}
      </div>
    </footer>
  );
}
