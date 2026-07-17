"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";

const GALLERY_IMAGES = [
  { src: "/gallery/gallery2.jpeg", alt: "Jaipur Cricket Circle — the squad" },
  {
    src: "/gallery/gallery3.jpeg",
    alt: "Jaipur Cricket Circle — on the pitch",
  },
  {
    src: "/gallery/gallery4.jpeg",
    alt: "Jaipur Cricket Circle — the Circle together",
  },
];

const LENGTH = GALLERY_IMAGES.length;
const HALF = Math.floor(LENGTH / 2);
const AUTOPLAY_MS = 4200;
const SWIPE_THRESHOLD = 50;
const WHEEL_THRESHOLD = 40;

export default function GallerySection() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragX = useRef<number | null>(null);
  const wheelLock = useRef(false);

  const next = useCallback(() => setCurrent((c) => (c + 1) % LENGTH), []);
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + LENGTH) % LENGTH),
    [],
  );

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, next]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragX.current = e.clientX;
    setPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragX.current === null) return;
    const delta = e.clientX - dragX.current;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    delta < 0 ? next() : prev();
    dragX.current = e.clientX;
  };

  const handlePointerUp = () => {
    dragX.current = null;
    setPaused(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    if (Math.abs(e.deltaX) < WHEEL_THRESHOLD || wheelLock.current) return;
    wheelLock.current = true;
    e.deltaX > 0 ? next() : prev();
    setTimeout(() => {
      wheelLock.current = false;
    }, 400);
  };

  return (
    <section
      id="gallery"
      className="theme-static-dark py-24 sm:py-32 relative overflow-hidden section-bg-royal"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-linear-to-r from-transparent via-jcc-accent to-transparent opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-jcc-accent/10 blur-[100px] pointer-events-none" />
      <div
        className="absolute inset-x-[-10%] inset-y-[-10%] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(35deg, transparent 0 26px, color-mix(in srgb, var(--color-jcc-accent) 12%, transparent) 26px 27px, transparent 27px 30px), repeating-linear-gradient(-35deg, transparent 0 26px, rgba(255,255,255,0.05) 26px 27px, transparent 27px 30px)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <AnimateIn className="text-center mb-14">
          <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.5em] text-jcc-accent font-black">
            <Camera className="w-5 h-5" />
            TEAM GALLERY
          </span>
          <h2 className="text-4xl min-[380px]:text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter mt-6 uppercase italic leading-tight">
            Beyond the <span className="text-gradient-cyan">Scorecard</span>
          </h2>
          <p className="mt-6 text-white/70 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Matches don&apos;t end at the scoreline.
            <br />
            This is the Circle — on the pitch, in the huddle, living it.
          </p>
        </AnimateIn>

        <AnimateIn delay={200} direction="scale">
          <div className="relative overflow-hidden rounded-[48px] border border-jcc-accent/30 shadow-[inset_0_0_60px_rgba(212,175,55,0.12),0_20px_60px_rgba(0,0,0,0.25)] p-4 sm:p-8 lg:p-10">
            <div
              className="noise-overlay pointer-events-none absolute inset-0 z-0"
              style={{ opacity: 0.02 }}
            />
            <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.22)_0%,rgba(212,175,55,0.08)_35%,transparent_65%)]" />
            <div className="pointer-events-none absolute inset-0 z-40 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
            <div
              className="relative h-70 sm:h-100 lg:h-125 touch-pan-y cursor-grab active:cursor-grabbing select-none"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => {
                setPaused(false);
                dragX.current = null;
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
            >
              {GALLERY_IMAGES.map((img, i) => {
                const diff = ((i - current + LENGTH + HALF) % LENGTH) - HALF;
                const isCenter = diff === 0;
                const abs = Math.abs(diff);
                const translate = diff === 0 ? 0 : diff > 0 ? 42 : -42;
                const scale = isCenter ? 1 : 0.92;
                const opacity = isCenter ? 1 : abs === 1 ? 0.45 : 0;
                const translateY = isCenter ? 0 : 20;
                const blur = isCenter ? 0 : 3;

                return (
                  <div
                    key={img.src}
                    className="absolute top-0 left-1/2 h-full w-[80%] sm:w-[62%] lg:w-[54%] rounded-[40px] overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      transform: `translateX(calc(-50% + ${translate}%)) translateY(${translateY}px) scale(${scale})`,
                      opacity,
                      filter: `blur(${blur}px)`,
                      boxShadow: isCenter
                        ? "0 30px 80px rgba(0,0,0,0.35)"
                        : "0 20px 40px rgba(0,0,0,0.25)",
                      zIndex: isCenter ? 30 : abs === 1 ? 20 : 10,
                    }}
                  >
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      sizes="(max-width: 768px) 80vw, 54vw"
                      className="object-cover"
                      priority
                    />
                    {isCenter && (
                      <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/5 to-black/35" />
                    )}
                  </div>
                );
              })}

              {/* Luxury overlay tagline — fixed to the center stage */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 px-6">
                <AnimateIn delay={450} direction="scale">
                  <p className="text-center text-2xl sm:text-4xl lg:text-6xl font-black uppercase italic tracking-[0.03em] text-white drop-shadow-[0_4px_28px_rgba(0,0,0,0.55)]">
                    Play. <span className="text-gradient-cyan">Connect.</span>{" "}
                    Thrive.
                  </p>
                </AnimateIn>
              </div>

              {/* Prev / Next controls */}
              <button
                onClick={prev}
                aria-label="Previous photo"
                className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-200"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                aria-label="Next photo"
                className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-200"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Dots */}
            <div className="mt-6 sm:mt-8 flex items-center justify-center gap-3">
              {GALLERY_IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i === current ? "w-8 bg-jcc-accent" : "w-2.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
