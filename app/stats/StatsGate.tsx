"use client";

// What /stats shows to someone without a member pass.
//
// A member who logged in on /profile before the pass existed still holds a
// session token in localStorage. That is tried first, quietly: if it's still
// valid the server issues the pass and the page reloads straight into the
// stats. Everyone else is sent to log in, and comes back here afterwards.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Loader2, ArrowRight } from "lucide-react";
import Jaali from "@/components/Jaali";

/** Headline counts shown to visitors, so the gate says what's behind it. */
export type GateTeaser = { matches: number; runs: number; sixes: number; players: number };

const INSIDE = [
  "Stat stories with share links",
  "Powerplay & death-over analysis",
  "Head-to-head compare",
  "Hidden gems",
  "Every player's cards and DNA",
  "Every scorecard since Season 2",
];

export default function StatsGate({ expiredOn, teaser }: { expiredOn?: string; teaser?: GateTeaser }) {
  const router = useRouter();
  const [checking, setChecking] = useState(!expiredOn);

  useEffect(() => {
    if (expiredOn) return;
    let token: string | null = null;
    try {
      token = localStorage.getItem("jcc_verified_session");
    } catch {}
    if (!token) {
      setChecking(false);
      return;
    }
    fetch("/api/player/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: token }),
    })
      .then((res) => {
        if (res.ok) router.refresh();
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router, expiredOn]);

  if (expiredOn) {
    const day = new Date(expiredOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return (
      <main className="theme-static-dark section-bg-royal relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-32">
        <Jaali />
        <div className="relative w-full max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-jcc-accent/30 bg-jcc-accent/10">
            <Lock className="h-6 w-6 text-jcc-accent" />
          </span>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">JCC Stats · Access ended</p>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-white md:text-5xl">
            Your 14 days are up<span className="text-jcc-accent">.</span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-white/65">
            Stats access for members runs for 14 days from first login, and yours ended on {day}. Speak to the JCC
            admins if you need it back.
          </p>
          <Link href="/" className="mt-10 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            Back to home <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="theme-static-dark section-bg-royal relative flex min-h-screen items-center overflow-hidden px-5 py-32 md:px-10">
      <Jaali />
      <div className="pointer-events-none absolute -right-40 -top-40 h-136 w-136 rounded-full bg-jcc-accent/15 blur-[120px]" />
      <div className="relative mx-auto grid w-full max-w-[88rem] items-center gap-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div>
          <p className="kicker inline-flex items-center gap-2 text-jcc-accent">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            JCC Intelligence · Members only
          </p>
          <h1 className="mt-6 font-heading text-[clamp(3.2rem,9vw,8.5rem)] font-extrabold leading-[0.86] tracking-[-0.045em] text-white">
            <span className="rise-mask"><span className="rise-line">Every ball,</span></span>
            <span className="rise-mask">
              <span className="rise-line">
                <span className="text-white/40">counted</span>
                <span className="text-jcc-accent">.</span>
              </span>
            </span>
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-white/70">
            {checking
              ? "Checking your membership…"
              : "The full analytics desk is for JCC members. Log in with your registered phone number to step inside."}
          </p>
          {!checking && (
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Link href="/profile?next=/stats" className="btn-gold group">
                Log in to view stats <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/profile" className="text-sm font-semibold tracking-tight text-white/70 underline decoration-jcc-accent decoration-2 underline-offset-4 hover:text-white">
                Not a member yet? Join the circle
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-white/12 bg-white/[0.05] p-7 backdrop-blur-md md:p-9">
          {teaser && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-b border-white/10 pb-8">
              {[
                ["Matches", teaser.matches],
                ["Runs", teaser.runs],
                ["Sixes", teaser.sixes],
                ["Players", teaser.players],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="kicker text-white/50">{label}</dt>
                  <dd className="mt-2 font-heading text-4xl font-bold leading-none tracking-[-0.05em] tabular-nums text-white md:text-5xl">
                    {String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="kicker mt-8 text-jcc-accent">What&apos;s inside</p>
          <ul className="mt-4 divide-y divide-white/10">
            {INSIDE.map((x, i) => (
              <li key={x} className="flex items-center gap-4 py-3.5">
                <span className="font-mono text-[11px] text-white/40">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-heading text-lg font-semibold tracking-[-0.02em] text-white">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
