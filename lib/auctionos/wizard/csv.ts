// CSV -> talent-pool-row parser for the Talent Pool wizard step. Lenient
// about column naming (case-insensitive, a couple of common aliases) since
// an organizer's spreadsheet is never going to match our schema exactly.
//
// Deviation from the original plan's signature
// (`parseTalentCsv(file): Promise<Row[]>`): this returns
// `{ rows, errors }` instead of a bare array, because the plan itself also
// asks for "row 4: missing name" style feedback "so the UI can show" it —
// a bare array has nowhere to carry that. Rows that fail validation are
// omitted from `rows` and reported in `errors` instead of throwing, so one
// bad row never fails the whole import.

import Papa from "papaparse";
import { parseMoneyLakhs } from "@/lib/auctionos/templates/jcc/rules";

export interface ParsedTalentRow {
  display_name: string;
  base_price: number;
  image_url: string | null;
  category_id: string | null;
  metadata: Record<string, unknown>;
}

// Minimal shape needed to resolve a CSV row's category column against
// categories the organizer already created — see CategoriesStep, which now
// runs before Talent Pool in the wizard for exactly this reason.
export interface CsvCategoryRef {
  id: string;
  name: string;
}

export interface TalentCsvRowError {
  row: number; // 1-indexed, counting header as row 0 (so "row 4" means the 4th data row)
  message: string;
}

export interface TalentCsvResult {
  rows: ParsedTalentRow[];
  errors: TalentCsvRowError[];
}

const NAME_KEYS = ["display_name", "name", "player", "player_name", "full_name"];
const PRICE_KEYS = ["base_price", "price", "base", "starting_price", "base price"];
const IMAGE_KEYS = ["image_url", "image", "photo", "photo_url", "avatar", "picture", "profile_image"];
const CATEGORY_KEYS = ["category", "category_name", "role", "position", "type", "category name"];

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function isRowEmpty(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => !v || !v.toString().trim());
}

export function parseTalentCsv(file: File, categories: CsvCategoryRef[] = []): Promise<TalentCsvResult> {
  // Match by normalized name (trim, lowercase) — same leniency as every
  // other column here. Built once per parse, not per row. Also indexes
  // each category's first word ("MVP Players" -> "mvp") as a fallback key,
  // since organizer spreadsheets commonly use the short role word ("mvp",
  // "regular", "guest") rather than the full category name — without this,
  // every row importing against the JCC Season 3 preset's "MVP Players" /
  // "Regular Players" / "Guest Players" categories would land unassigned.
  // The full-name key always wins on collision (set first, never
  // overwritten below).
  const categoryByName = new Map<string, string>();
  for (const category of categories) {
    const full = category.name.trim().toLowerCase();
    categoryByName.set(full, category.id);
    const firstWord = full.split(/\s+/)[0];
    if (firstWord && !categoryByName.has(firstWord)) categoryByName.set(firstWord, category.id);
  }

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedTalentRow[] = [];
        const errors: TalentCsvRowError[] = [];

        const rawRows = results.data ?? [];
        // Build a normalized-key -> original-key map from the header once.
        const fields = results.meta.fields ?? [];
        const keyMap = new Map<string, string>();
        for (const field of fields) {
          keyMap.set(normalizeKey(field), field);
        }

        const nameField = NAME_KEYS.map((k) => keyMap.get(k)).find(Boolean);
        const priceField = PRICE_KEYS.map((k) => keyMap.get(k)).find(Boolean);
        const imageField = IMAGE_KEYS.map((k) => keyMap.get(k)).find(Boolean);
        const categoryField = CATEGORY_KEYS.map((k) => keyMap.get(k)).find(Boolean);

        rawRows.forEach((rawRow, index) => {
          const rowNumber = index + 1;
          if (isRowEmpty(rawRow)) return; // fully-empty row, skip silently

          const nameValue = nameField ? rawRow[nameField]?.trim() : undefined;
          if (!nameValue) {
            errors.push({ row: rowNumber, message: "missing name" });
            return;
          }

          const priceRaw = priceField ? rawRow[priceField]?.trim() : undefined;
          let priceNumber = 0;
          if (priceRaw !== undefined && priceRaw !== "") {
            const parsed = parseMoneyLakhs(priceRaw);
            if (parsed === null) {
              errors.push({ row: rowNumber, message: `invalid base_price "${priceRaw}"` });
              return;
            }
            priceNumber = parsed;
          }

          const imageValue = imageField ? rawRow[imageField]?.trim() || null : null;

          // Category is matched by name against categories the organizer
          // already created (Categories now runs before Talent Pool in the
          // wizard for exactly this). An unmatched name doesn't fail the
          // row — it's just left unassigned, same "one bad cell never
          // fails the whole import" stance as base_price above, and
          // reported as a warning so the organizer notices and can fix it
          // via a category rename or the pool table's own assignment UI.
          const categoryRaw = categoryField ? rawRow[categoryField]?.trim() : undefined;
          let categoryId: string | null = null;
          if (categoryRaw) {
            const matched = categoryByName.get(categoryRaw.toLowerCase());
            if (matched) {
              categoryId = matched;
            } else {
              errors.push({ row: rowNumber, message: `category "${categoryRaw}" not found — left unassigned` });
            }
          }

          // Everything else in the row (any other CSV column) is passed
          // through into metadata, keyed by its original header text. The
          // image column is normalized to a single metadata.image_url key
          // regardless of which alias the organizer's header used, so
          // downstream UI has one reliable place to look.
          const metadata: Record<string, unknown> = {};
          for (const field of fields) {
            if (field === nameField || field === priceField || field === imageField || field === categoryField) continue;
            const value = rawRow[field];
            if (value !== undefined && value.trim() !== "") {
              metadata[field] = value.trim();
            }
          }
          if (imageValue) metadata.image_url = imageValue;

          rows.push({
            display_name: nameValue,
            base_price: Number.isFinite(priceNumber) ? priceNumber : 0,
            image_url: imageValue,
            category_id: categoryId,
            metadata,
          });
        });

        resolve({ rows, errors });
      },
      error: (err: Error) => reject(err),
    });
  });
}
