# JCC Rebrand & Fixes — Session Reference (2026-07)

This document summarizes a single working session that touched the site's
visual identity twice, renamed a content vertical, and fixed a scroll-jack
bug. **The "Royal White & Blue" section is the current live design system.**
Everything under "Superseded" is historical context only — do not use those
color values.

---

## 1. Current design system: Royal White & Blue

Full reversal of an earlier same-day dark theme. White dominates (~55%),
Royal Blue defines identity (~30%), Gold signals prestige (~10%). Direction:
Apple product pages / BCCI / India Test jersey / Rolex / Aman Resorts —
explicitly *not* a dark "luxury watch" aesthetic.

### Palette (`app/globals.css` `@theme` block)

| Token | Value | Role |
|---|---|---|
| `--color-jcc-navy-deep` | `#FCFBF8` | Page background (Warm Championship White) |
| `--color-jcc-navy` | `#FFFFFF` | Card surface — **always white**, even inside a Royal Blue band |
| `--color-jcc-navy-light` | `#F7F5EF` | Secondary/elevated surface |
| `--color-jcc-blue` *(new)* | `#12233F` | Primary Royal Blue |
| `--color-jcc-blue-deep` *(new)* | `#0D1728` | Dark Blue — footer / deep bands |
| `--color-jcc-accent` | `#D4AF37` | Primary Gold |
| `--color-jcc-accent-highlight` | `#F3C96A` | Highlight Gold |
| `--color-jcc-accent-dark` | `#A97824` | Dark Gold |
| `--color-white` | `#12233F` | **The foreground-ink lever** — see below |
| `--color-jcc-text-muted` | `#667085` | Secondary text |
| `--color-jcc-border` | `rgba(18,35,63,0.08)` | Hairline border |
| `--color-jcc-border-bright` | `rgba(212,175,55,0.25)` | Gold luxury divider |
| `--color-jcc-danger` | `#B0473F` | Destructive actions only (not a brand accent) |

### The core lever

`--color-white` is what ~1,400 `text-white` / `bg-white/x` / `border-white/x`
utilities resolve through across the codebase. Flipping this one variable
(navy-ink-on-light vs. ivory-ink-on-dark) recolors most of the site for free.
This same lever has now been used for **three** rebrands in this codebase
(see History) — it's the reason a full palette swap is tractable in one
session instead of touching every file by hand.

### Section rhythm: White → Royal Blue → White

The homepage alternates band by band:

`Hero (White) → Sunday Match (Blue) → Rivalry (White) → Community (Blue) →
Boundary Banter (White) → Why JCC (Blue) → Final CTA (White) → Footer (Blue,
closing band)`

Implemented via `.theme-static-dark` — a class that **opts a section out of
the light default** and remaps its foreground/border tokens to white-on-blue.
Combined with two plain background utilities: `.section-bg-royal` /
`.section-bg-royal-deep`.

**Important gotcha (already fixed, don't reintroduce it):** `.theme-static-dark`
must **not** remap `--color-jcc-navy` (the card-surface token). Cards use
`.premium-card`, which must stay literally white in every context — that's
what makes "a white card floating on a Royal Blue section" read as two
distinct colors instead of invisible blue-on-blue. If you add another
section-level "stay dark" class in the future, keep the surface token out of
its remap.

Card-level alternation reuses a `light`/`royal` boolean + `index % 2` pattern
across `SundayMatchSection.tsx`, `CommunitySection.tsx`, `WhyJCCSection.tsx`,
`BoundaryBanterSection.tsx`, and `ScorelineCard.tsx`'s `isDark` prop.

### Buttons

- **Primary** (`.btn-vibrant-blue`): Royal Blue fill, white text, thin gold
  border. Hover = lift + metallic gold sweep + soft shadow.
- **Secondary** (`.btn-ghost`): white fill, gold outline, Royal Blue text.
  Hover fills gold.

### Cards

`.premium-card` / `.glass-card-dark`: white background, thin hairline
border, **soft shadow only** (no harsh black box-shadows), gold
border-highlight + tiny elevation on hover.

### Scope notes — what this pass did *not* touch

- `HeroSection.tsx`'s ~600-line illustrative cricket-ball/floodlight SVG
  scene was recolored at the overlay level (opacity of `stadium-glow`,
  `noise-overlay` dialed down for a lighter feel) but not rebuilt. Two
  `#081826` hex values remain — they're 3D-shadow shading on the ball
  graphic, not theme colors.
- Admin-panel internal forms/tables beyond what the token flip auto-cascades
  were left as-is (lower-traffic internal tool, same call made in the prior
  rebrand).
- Literal representational colors are not "accents" and were left alone —
  e.g. cricket-ball SVGs keep red/maroon tones because that's what an actual
  cricket ball looks like.

### Exceptions to the palette (kept deliberately)

1. **Team-identity colors** — Mavericks amber `#E8A820`, NeuroStrikers blue
   `#3B6FC4`, The Outliers green `#1A7A5E`. Canonical source: `lib/teams.ts`.
   Several places had drifted from canonical during earlier theme churn
   (register page, `CommunitySection.tsx`, `RivalryPageClient.tsx`) — fixed
   to match `lib/teams.ts`.
2. **Danger red** (`--color-jcc-danger`) for destructive actions only.

---

## 2. Rename: "Chewvana Times" → "Boundary Banter"

Full rename, not just a heading swap:

- **Route**: `/chewvana-times` → `/boundary-banter` (folder moved). Permanent
  308 redirects from the old path — including the dynamic `/chewvana-times/:slug`
  pattern — live in `next.config.js`.
- **Files renamed**: `ChewvanaTimesSection.tsx` → `BoundaryBanterSection.tsx`,
  `ChewvanaControl.tsx` → `BoundaryBanterControl.tsx`,
  `public/images/chewvana/` → `public/images/boundary-banter/`, plus matching
  function/interface names inside them.
- **All visible text** updated: nav, footer, headings, admin labels, about
  page, sitemap, byline fallback text ("Chewvana Desk" → "Boundary Desk").

**Deliberately NOT renamed:** the Supabase table `chewvana_articles`.
Renaming a live production table needs an actual migration, not a code
edit — if you see `.from("chewvana_articles")` anywhere, that's expected,
not a bug.

---

## 3. Scroll-jack bug fix (`components/ScrollSystem.tsx`)

**Symptom:** on the homepage, scrolling registered as "reached the bottom"
(and started accumulating charge toward the next-page navigation) well
before the user had actually scrolled to the bottom. Other, shorter pages
didn't show the bug.

**Root cause:** `ScrollSystem` caches `document.documentElement.scrollHeight`
via a `ResizeObserver` so the wheel handler never forces a layout reflow on
the hot path. That cache lags real layout by a frame or more — invisible on
short pages, very visible on the homepage (by far the tallest, most
section-heavy page), where a stale short cached height made
`scrollY + innerHeight >= cachedHeight` trip early.

**Fix:** keep the cheap cached comparison as a fast pre-filter (zero cost on
the common "not near bottom" case), but once it *thinks* you're at the
bottom, pay for one fresh `scrollHeight` read to confirm before starting the
dwell timer. The reflow cost only ever hits the rare near-bottom branch, not
every wheel tick.

A second safety net (`NAV_FALLBACK_MS`) was added after this session's work:
if `transitioningRef` never clears because the destination pathname never
actually changes (e.g. a client-side redirect back to the same route), a
5-second fallback timer force-unlocks scroll input instead of leaving it
frozen for the rest of the session.

---

## History (superseded — for context only, do not use these values)

1. **Day/Night Seam** (June 2026) — light "red-ball day" / dark "pink-ball
   night" theme, switched automatically via `prefers-color-scheme`. Retired
   in favor of a single fixed theme.
2. **Luxury Navy & Gold** (2026-07, earlier same session as this doc) — dark
   navy background (`#0C1424`), gold-only accent, no light mode. Live for a
   few hours before the Royal White & Blue brief replaced it. Background
   `#0C1424`, Surface `#152238`, Elevated `#1E2E49`, Primary Text `#F6F2E9`
   (ivory-on-dark, the opposite direction of the current theme).

Every rebrand in this codebase has used the same underlying technique:
remap `--color-white` and a handful of `--color-jcc-*` CSS custom
properties in `app/globals.css`, and the ~1,400 `text-white`/`bg-white/x`
call sites across the app follow automatically. When asked to retheme
again, start there — then sweep for hardcoded hex that bypasses the token
system (search for stray `#` hex literals in `style={{...}}` and
`bg-[#...]` / `text-[#...]` arbitrary-value classes).
