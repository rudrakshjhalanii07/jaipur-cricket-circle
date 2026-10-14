// Where the face is in a member's photo, so every surface (round avatars, the
// player hero, story cards) can frame the face instead of guessing.
//
// Stored on players.image_focus (supabase/add_player_image_focus.sql), set by
// face detection at upload or from the admin "Photo framing" panel, and
// adjustable by hand. Photo URLs carry it as a fragment — `…/x.webp#f=…` — so
// it travels through every existing name → URL map untouched; browsers drop
// the fragment when fetching, so the image itself is unaffected.

import type { CSSProperties } from "react";

export type PhotoFocus = {
  /** Face centre, as fractions of the image's width and height. */
  x: number;
  y: number;
  /** Face height as a fraction of the image height. */
  s: number;
  /** Image aspect ratio, width / height. */
  a: number;
  /** Image width in pixels (how sharp it can be drawn). */
  w: number;
  /** "auto" from face detection, "manual" when someone framed it by hand. */
  by?: "auto" | "manual";
};

/** A photo narrower than this looks soft filling a 1080px story card (flagged, still drawn full-bleed). */
export const SHARP_WIDTH = 900;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Validates untrusted input (a request body, a DB row) into a focus, or null. */
export function parseFocus(v: unknown): PhotoFocus | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const num = (k: string) => (typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : null);
  const x = num("x"), y = num("y"), s = num("s"), a = num("a"), w = num("w");
  if (x == null || y == null || s == null || a == null || w == null || s <= 0 || a <= 0 || w <= 0) return null;
  return { x: clamp01(x), y: clamp01(y), s: Math.min(1, s), a, w: Math.round(w), by: o.by === "manual" ? "manual" : "auto" };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** The URL with its focus riding along as a fragment. */
export function withFocus(url: string, focus: PhotoFocus | null | undefined): string {
  const bare = url.split("#")[0];
  if (!focus) return bare;
  return `${bare}#f=${r3(focus.x)},${r3(focus.y)},${r3(focus.s)},${r3(focus.a)},${focus.w}`;
}

/** The focus a URL carries, or null. */
export function focusOf(url: string | null | undefined): PhotoFocus | null {
  const m = url?.match(/#f=([\d.]+),([\d.]+),([\d.]+),([\d.]+),(\d+)/);
  if (!m) return null;
  return parseFocus({ x: +m[1], y: +m[2], s: +m[3], a: +m[4], w: +m[5] });
}

/**
 * Style for an object-cover <img> in a box of aspect `box` (w/h): centres the
 * face and zooms until it fills `share` of the box height. No focus → the old
 * top-centred crop.
 */
export function focusStyle(focus: PhotoFocus | null, share = 0.55, box = 1): CSSProperties {
  if (!focus) return { objectPosition: "50% 15%" };
  // Under object-cover, the image's height in box heights.
  const imgH = focus.a > box ? 1 : box / focus.a;
  const face = focus.s * imgH;
  const zoom = Math.min(3, Math.max(1, share / face));
  const pos = `${(focus.x * 100).toFixed(1)}% ${(focus.y * 100).toFixed(1)}%`;
  return { objectPosition: pos, transform: zoom > 1.01 ? `scale(${zoom.toFixed(3)})` : undefined, transformOrigin: pos };
}
