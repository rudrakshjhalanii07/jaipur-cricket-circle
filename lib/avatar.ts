/**
 * Generates a DiceBear "thumbs" avatar URL for a player who hasn't uploaded a photo.
 * The avatar is deterministic — same name → same character, every time.
 *
 * Colors follow JCC team identity:
 *  • Mavericks     → deep navy-blue background + cyan accent
 *  • NeuroStrikers → deep crimson background + red accent
 *  • Unassigned    → dark charcoal background + slate-grey accent
 *
 * @param name - Player display name used as the seed.
 * @param team - Optional team name to drive color theming.
 * @param size - Avatar size in pixels (default 256 for crisp renders).
 */
export function getDiceBearUrl(
  name: string,
  team?: string | null,
  size: number = 256
): string {
  const seed = encodeURIComponent((name || "JCC Player").trim());

  // Team-based palette: backgroundColor + shapeColor (comma-separated hex without #)
  let backgroundColor: string;
  let shapeColor: string;

  if (team === "Mavericks") {
    backgroundColor = "0a1f3d,0d2855,071428";  // deep navy-blue
    shapeColor = "00c2ff,38bdf8,0ea5e9";        // cyan / sky-blue
  } else if (team === "NeuroStrikers") {
    backgroundColor = "3b0a0a,520c0c,2a0707";   // deep crimson-red
    shapeColor = "ff4d4d,f87171,dc2626";         // vivid red
  } else {
    // Unassigned / unknown — dark charcoal
    backgroundColor = "0f172a,1e293b,0d1117";
    shapeColor = "475569,64748b,94a3b8";         // slate-grey
  }

  return (
    `https://api.dicebear.com/9.x/thumbs/svg` +
    `?seed=${seed}` +
    `&size=${size}` +
    `&backgroundColor=${backgroundColor}` +
    `&shapeColor=${shapeColor}`
  );
}

/**
 * Generates an ivory "membership certificate" placeholder for a member
 * without a photo — engraved initials on paper stock, matching the
 * monochrome portrait treatment instead of a playful colored illustration.
 * Used by the Member Directory card components only.
 */
export function getMonogramAvatar(name: string): string {
  const initials =
    (name || "JCC")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "JCC";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
    <defs>
      <radialGradient id="g" cx="50%" cy="40%" r="75%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#F3EFE4"/>
      </radialGradient>
    </defs>
    <rect width="400" height="500" fill="url(#g)"/>
    <rect x="20" y="20" width="360" height="460" rx="6" fill="none" stroke="rgba(18,35,63,0.10)" stroke-width="1"/>
    <text x="201" y="273" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="112" font-weight="700" letter-spacing="4" fill="rgba(255,255,255,0.65)">${initials}</text>
    <text x="200" y="271" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="112" font-weight="700" letter-spacing="4" fill="rgba(18,35,63,0.40)">${initials}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}
