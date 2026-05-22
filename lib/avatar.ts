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
