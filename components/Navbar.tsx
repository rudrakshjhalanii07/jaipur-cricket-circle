"use client";

// The site bar: a floating capsule that tucks away as you read down the page
// and comes back the moment you scroll up. Stats is the headline act, so it
// gets its own gold pill rather than a place in the link row. On phones the
// links live in a full-screen menu that deals its items in.

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, UserRound } from "lucide-react";
import { gsap, useGSAP, reduceMotion } from "@/components/motion/gsap";
import { focusStyle, parseFocus } from "@/lib/photo-focus";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/members", label: "Members" },
  { href: "/boundary-banter", label: "Boundary Banter" },
  { href: "/about", label: "About" },
];
const STATS = { href: "/stats", label: "Stats" };
const PROFILE = { href: "/profile", label: "Profile" };
const WHATSAPP_URL = "https://chat.whatsapp.com/LtuFpx2EcKO4E5yZWP8aue?mode=gi_t";

// The signed-in member's photo for the profile button. The profile page keeps
// the member in localStorage and fires "jcc-member" whenever it changes.
const subscribeMember = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("jcc-member", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("jcc-member", cb);
  };
};
const readMember = () => {
  try {
    return localStorage.getItem("jcc_verified_player");
  } catch {
    return null;
  }
};
function useMemberPhoto() {
  const raw = useSyncExternalStore(subscribeMember, readMember, () => null);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { name?: string; image_url?: string | null; image_focus?: unknown };
    return p.image_url ? { src: p.image_url.split("#")[0], name: p.name ?? "", focus: parseFocus(p.image_focus) } : null;
  } catch {
    return null;
  }
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const photo = useMemberPhoto();
  const menuId = useId();
  const overlay = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // /stats has its own sticky section capsule, so the site bar scrolls away
  // with the page there instead of staying pinned.
  const pinned = !(pathname === "/stats" || pathname.startsWith("/stats/"));

  // Hide on the way down, show on the way up. One read per frame.
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 24);
      if (Math.abs(y - last) > 6) {
        setHidden(y > last && y > 160);
        last = y;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Close on navigation (deferred a frame, per the project's set-state-in-effect convention).
  useEffect(() => {
    const id = requestAnimationFrame(() => setIsOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        trigger.current?.focus();
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  // The menu: a curtain drops, then the links rise out of their masks.
  useGSAP(
    () => {
      const el = overlay.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      if (reduceMotion()) {
        gsap.set(el, { autoAlpha: isOpen ? 1 : 0, clipPath: "inset(0 0 0% 0)" });
        return;
      }
      if (isOpen) {
        gsap
          .timeline()
          .set(el, { autoAlpha: 1 })
          .fromTo(el, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: "expo.inOut" })
          .fromTo(q("[data-menu-link]"), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.06 }, 0.35)
          .fromTo(q("[data-menu-foot]"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, 0.6);
      } else {
        gsap.to(el, { clipPath: "inset(0 0 100% 0)", duration: 0.5, ease: "expo.inOut", onComplete: () => void gsap.set(el, { autoAlpha: 0 }) });
      }
    },
    { dependencies: [isOpen] },
  );

  const show = !hidden || isOpen;

  return (
    <>
      <nav
        aria-label="Main"
        className={`${pinned ? "fixed" : "absolute"} inset-x-0 top-0 z-50 px-3 pt-3 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-5 sm:pt-4`}
        style={{ transform: pinned && !show ? "translateY(-130%)" : undefined }}
      >
        <div
          className={`theme-static-dark mx-auto flex h-14 max-w-[88rem] items-center justify-between gap-3 rounded-full border pl-2 pr-2 transition-[background-color,border-color,box-shadow] duration-500 sm:h-16 sm:pl-3 ${
            scrolled || !pinned
              ? "border-white/10 bg-[#0B1424]/85 shadow-[0_20px_50px_-20px_rgba(11,20,36,0.7)] backdrop-blur-xl"
              : "border-white/10 bg-[#0B1424]/70 backdrop-blur-md"
          }`}
        >
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <img src="/jcc_logo.png" alt="JCC" width={96} height={96} fetchPriority="high" className="h-10 w-10 object-contain transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110 sm:h-12 sm:w-12" />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="font-heading text-[15px] font-bold tracking-[-0.02em] text-white">Jaipur Cricket Circle</span>
              <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/50">Est. 2026 · Jaipur</span>
            </span>
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative block rounded-full px-4 py-2 text-[13.5px] font-semibold tracking-tight transition-colors duration-300 ${active ? "text-white" : "text-white/60 hover:text-white"}`}
                  >
                    <span className="relative block overflow-hidden">
                      <span className="block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-full">{link.label}</span>
                      <span aria-hidden className="absolute inset-0 translate-y-full text-jcc-accent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0">
                        {link.label}
                      </span>
                    </span>
                    {active && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-jcc-accent" />}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            <Link
              href={STATS.href}
              aria-current={pathname === STATS.href ? "page" : undefined}
              className="group inline-flex h-10 items-center gap-2 rounded-full bg-jcc-accent px-4 text-[13px] font-bold tracking-tight text-[#0B1424] transition-[background-color,transform] duration-300 hover:scale-[1.04] hover:bg-jcc-accent-highlight sm:h-12 sm:px-5"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0B1424] opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0B1424]" />
              </span>
              {STATS.label}
              <ArrowUpRight className="hidden h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-45 sm:block" />
            </Link>
            <Link
              href={PROFILE.href}
              aria-label="Profile"
              aria-current={pathname === PROFILE.href ? "page" : undefined}
              className={`relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 transition-[border-color,color,transform] duration-300 hover:scale-[1.05] sm:h-12 sm:w-12 ${
                pathname === PROFILE.href ? "border-jcc-accent text-jcc-accent" : "border-white/20 text-white/80 hover:border-jcc-accent hover:text-jcc-accent"
              }`}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.src} alt="" className="h-full w-full object-cover" style={focusStyle(photo.focus, 0.6)} />
              ) : (
                <UserRound className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
              )}
            </Link>
            <button
              ref={trigger}
              type="button"
              onClick={() => setIsOpen((v) => !v)}
              aria-expanded={isOpen}
              aria-controls={menuId}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-white lg:hidden sm:h-12 sm:w-12"
            >
              <span className={`absolute h-[1.5px] w-4 bg-current transition-transform duration-500 ${isOpen ? "rotate-45" : "-translate-y-[4px]"}`} />
              <span className={`absolute h-[1.5px] w-4 bg-current transition-transform duration-500 ${isOpen ? "-rotate-45" : "translate-y-[4px]"}`} />
            </button>
          </div>
        </div>
      </nav>

      <div
        id={menuId}
        ref={overlay}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="theme-static-dark fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[#0B1424] px-6 pb-10 pt-28 lg:hidden"
        style={{ visibility: "hidden", clipPath: "inset(0 0 100% 0)" }}
      >
        <div aria-hidden className="pitch-grid absolute inset-0" />
        <ul className="relative space-y-1">
          {[...navLinks, STATS, PROFILE].map((link, i) => {
            const active = pathname === link.href;
            return (
              <li key={link.href} className="overflow-hidden">
                <Link
                  data-menu-link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-baseline gap-4 py-1 font-heading text-5xl font-extrabold tracking-[-0.05em] sm:text-6xl ${active ? "text-jcc-accent" : "text-white"}`}
                >
                  <span className="font-mono text-xs font-medium tracking-normal text-white/40">{String(i + 1).padStart(2, "0")}</span>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div data-menu-foot className="relative mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="kicker text-white/70 hover:text-jcc-accent">
            WhatsApp group ↗
          </a>
          <span className="kicker text-white/40">Every ball, counted.</span>
        </div>
      </div>
    </>
  );
}
