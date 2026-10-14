import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Magnetic from "@/components/motion/Magnetic";

const WHATSAPP_URL = "https://chat.whatsapp.com/LtuFpx2EcKO4E5yZWP8aue?mode=gi_t";

// The last word on the home page: the pitch to get your own name into the
// numbers everything above was built from.
export default function FinalCTA() {
  return (
    <section data-panel className="theme-static-dark print-grain relative overflow-hidden bg-[#0B1424]">
      <div aria-hidden className="pitch-grid absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-jcc-accent/15 blur-[150px]" />
      <div className="relative mx-auto max-w-[88rem] px-5 py-32 text-center md:px-10 md:py-48">
        <p data-reveal className="kicker text-jcc-accent">10 · Your turn</p>
        <h2 data-split="chars" className="mx-auto mt-6 font-heading text-[clamp(3.2rem,11vw,11rem)] font-extrabold leading-[0.84] tracking-[-0.045em] text-white">
          Get on the board.
        </h2>
        <p data-reveal className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/65">
          Every run you score, every wicket you take, every catch you hold — counted, ranked and written up. Season 4 starts 13 November.
        </p>
        <div data-reveal className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Magnetic>
            <Link href="/profile" className="btn-gold group">
              Join the Circle
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
            </Link>
          </Magnetic>
          <Magnetic strength={0.25}>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              WhatsApp group
            </a>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
