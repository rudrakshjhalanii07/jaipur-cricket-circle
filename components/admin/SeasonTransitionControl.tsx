"use client";

import { useState, useEffect, useCallback } from "react";
import { History, Trophy, ArrowRight, Loader2, Plus, X, MapPin, Check } from "lucide-react";
import { fetchSeasons, type Season } from "@/lib/seasons";
import { fetchAllSeries, type Series } from "@/lib/series";
import { MATCH_SLOT_MINUTES } from "@/lib/season-schedule";
import { TEAMS, TEAM_ORDER_ALL, type TeamId } from "@/lib/teams";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminSkeleton from "@/components/admin/AdminSkeleton";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

// A season declares its own roster — 2 teams, 4, or more — so the form builds
// a list rather than offering a fixed set of captain fields.
interface RosterEntry {
  team_id: TeamId;
  captain: string;
}

interface NewSeasonForm {
  title: string;
  season_label: string;
  roster: RosterEntry[];
  started_at: string;
}

const EMPTY_FORM: NewSeasonForm = {
  title: "",
  season_label: "",
  roster: TEAM_ORDER_ALL.map((team_id) => ({ team_id, captain: "" })),
  started_at: new Date().toISOString().slice(0, 10),
};

// ── Week venues and start times ──────────────────────────────────────────────
// Grounds are booked a few days out, so this is the one place the schedule's
// venue and slot get finalized — the scorecard import form only reaches a match
// after it has been played, which is too late to be useful to members.
//
// The time entered is the FIRST match's; the rest of the week follows it
// automatically, MATCH_SLOT_MINUTES apart.

/**
 * What is still unknown about a week, in the words the row shows.
 *
 * Naming the missing half matters: a booked ground sitting under a bare "TBC"
 * reads as though the ground itself were unconfirmed, when it is only the slot
 * that has not been set.
 */
function weekStatus(w: Series): string {
  if (w.venue && w.start_time) return "Confirmed";
  if (w.venue) return "Time TBC";
  if (w.start_time) return "Venue TBC";
  return "TBC";
}

/** What the admin is editing for one week, before it is saved. */
interface WeekDraft {
  venue: string;
  /** 24h "HH:MM", as <input type="time"> wants it. */
  start_time: string;
}

function WeekSchedulePanel({
  seasonId,
  adminPassword,
}: {
  seasonId: string;
  adminPassword?: string;
}) {
  const [weeks, setWeeks] = useState<Series[]>([]);
  const [drafts, setDrafts] = useState<Record<string, WeekDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const draftFor = (w: Series): WeekDraft =>
    drafts[w.id] ?? { venue: w.venue ?? "", start_time: w.start_time ?? "" };

  const load = useCallback(async () => {
    setLoading(true);
    const all = await fetchAllSeries();
    const mine = all
      .filter((s) => s.season_id === seasonId && s.week_no != null)
      .sort((a, b) => (a.week_no ?? 0) - (b.week_no ?? 0));
    setWeeks(mine);
    setDrafts(
      Object.fromEntries(
        mine.map((s) => [
          s.id,
          { venue: s.venue ?? "", start_time: s.start_time ?? "" },
        ]),
      ),
    );
    setLoading(false);
  }, [seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (series: Series) => {
    setSavingId(series.id);
    setSavedId(null);
    setError(null);
    try {
      const draft = draftFor(series);
      const res = await fetch("/api/admin/seasons/week-schedule", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({
          series_id: series.id,
          venue: draft.venue,
          start_time: draft.start_time,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save week");

      setWeeks((prev) =>
        prev.map((w) =>
          w.id === series.id
            ? {
                ...w,
                venue: data.series.venue,
                start_time: data.series.start_time,
              }
            : w,
        ),
      );
      setSavedId(series.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save week");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <AdminSkeleton rows={3} rowHeight="52px" />;
  if (weeks.length === 0) return null;

  return (
    <div className="premium-card p-8 mb-8">
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-jcc-accent-dark mb-1">
        Week Venues &amp; Timings
      </p>
      <p className="text-sm text-jcc-text-muted font-medium mb-6">
        Anything left blank shows as TBC on the public schedule — nothing is
        assumed. The time is the FIRST match&rsquo;s; the rest of that week
        follow it {MATCH_SLOT_MINUTES} minutes apart. Edit a row and press Save;
        clear a field to put it back to TBC.
      </p>

      <div className="space-y-2">
        {weeks.map((w) => {
          const draft = draftFor(w);
          const dirty =
            draft.venue !== (w.venue ?? "") ||
            draft.start_time !== (w.start_time ?? "");
          const status = weekStatus(w);
          return (
            // `.admin-input` is unlayered CSS and hardcodes width:100%, which
            // beats any Tailwind width utility put on the input itself. So the
            // grid sizes the CELLS and each input simply fills the one it is in.
            <div
              key={w.id}
              className="grid grid-cols-1 items-center gap-2 rounded-lg border border-jcc-border/60 bg-white/[0.02] px-3 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_8.5rem_auto] sm:gap-3"
            >
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs font-black uppercase tracking-wide">
                  {w.name}
                </span>
                {/* Names what is actually missing. A row reading "TBC" beside a
                    booked ground made the ground look unconfirmed. */}
                <span
                  className={`truncate text-[10px] font-black uppercase tracking-widest ${
                    status === "Confirmed"
                      ? "text-jcc-accent-dark"
                      : "text-jcc-text-muted"
                  }`}
                >
                  {status}
                </span>
              </div>
              <input
                type="text"
                className="admin-input mt-0!"
                placeholder="Venue — TBC"
                value={draft.venue}
                onChange={(e) =>
                  setDrafts({
                    ...drafts,
                    [w.id]: { ...draft, venue: e.target.value },
                  })
                }
              />
              <input
                type="time"
                // An unset week shows midnight rather than a blank dial. It is
                // only what the picker opens on — the week stays TBC until the
                // time is actually changed and saved.
                value={draft.start_time || "00:00"}
                className="admin-input mt-0! px-3! text-center"
                aria-label={`${w.name} first match start time`}
                onChange={(e) =>
                  setDrafts({
                    ...drafts,
                    [w.id]: { ...draft, start_time: e.target.value },
                  })
                }
              />
              <button
                type="button"
                disabled={savingId === w.id || !dirty}
                onClick={() => save(w)}
                className="inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-jcc-accent-dark/40 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-jcc-accent-dark transition-colors hover:bg-jcc-accent-dark/10 disabled:cursor-not-allowed disabled:border-jcc-border/60 disabled:text-jcc-text-muted disabled:opacity-40"
                title="Save this week's venue and start time"
              >
                {savingId === w.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : savedId === w.id && !dirty ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
                {savedId === w.id && !dirty ? "Saved" : "Save"}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-[12px] font-black text-jcc-danger uppercase tracking-widest">
          {error}
        </p>
      )}
    </div>
  );
}

export default function SeasonTransitionControl({ adminPassword }: { adminPassword?: string }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NewSeasonForm>(EMPTY_FORM);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  async function loadSeasons() {
    setLoading(true);
    const data = await fetchSeasons();
    setSeasons(data);
    setLoading(false);
  }

  useEffect(() => {
    loadSeasons();
  }, []);

  const activeSeason = seasons.find((s) => s.status === "active") ?? null;

  const availableTeams = TEAM_ORDER_ALL.filter(
    (id) => !form.roster.some((r) => r.team_id === id),
  );

  const canSubmit =
    !!activeSeason &&
    !!form.title.trim() &&
    !!form.started_at &&
    form.roster.length >= 2 &&
    form.roster.every((r) => r.captain.trim());

  const setRoster = (roster: RosterEntry[]) => setForm({ ...form, roster });

  const handleSubmit = async () => {
    if (!activeSeason) return;
    setSaving(true);
    setError(null);
    setSuccessId(null);
    try {
      const response = await fetch("/api/admin/seasons/archive-and-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || "",
        },
        body: JSON.stringify({
          old_season_id: activeSeason.id,
          new_title: form.title.trim(),
          new_season_label: form.season_label.trim() || null,
          new_started_at: form.started_at,
          teams: form.roster.map((r) => ({
            team_id: r.team_id,
            captain: r.captain.trim(),
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transition failed");

      setSuccessId(data.new_season_id as string);
      setForm(EMPTY_FORM);
      await loadSeasons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <AdminPageHeader title="Seasons" subtitle="Archive & Transition" />
        <AdminSkeleton rows={2} rowHeight="120px" />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title="Seasons" subtitle="Archive & Transition" />

      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        <AdminStatCard
          label="Current Active Season"
          value={activeSeason?.title ?? "None"}
          sub={activeSeason?.season_label ?? undefined}
          icon={Trophy}
        />
        <AdminStatCard
          label="Archived Seasons"
          value={seasons.filter((s) => s.status === "archived").length}
          icon={History}
        />
      </div>

      {activeSeason && (
        <WeekSchedulePanel seasonId={activeSeason.id} adminPassword={adminPassword} />
      )}

      {!activeSeason ? (
        <div className="premium-card p-8 text-center text-jcc-text-muted text-sm font-bold">
          No active season found — nothing to archive.
        </div>
      ) : (
        <div className="premium-card p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-jcc-accent-dark mb-1">
            Start the Next Chapter
          </p>
          <p className="text-sm text-jcc-text-muted font-medium mb-6">
            Archives &ldquo;{activeSeason.title}&rdquo; and creates a new active season in one step.
          </p>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="admin-label">New Season Title</label>
              <input
                type="text"
                className="admin-input"
                placeholder="e.g. The Rising Era"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="admin-label">Season Label</label>
              <input
                type="text"
                className="admin-input"
                placeholder="e.g. Season 3"
                value={form.season_label}
                onChange={(e) => setForm({ ...form, season_label: e.target.value })}
              />
            </div>
            <div>
              <label className="admin-label">Start Date</label>
              <input
                type="date"
                className="admin-input"
                value={form.started_at}
                onChange={(e) => setForm({ ...form, started_at: e.target.value })}
              />
            </div>
          </div>

          {/* ── Roster ── */}
          <div className="mt-8">
            <div className="flex items-center justify-between gap-3 mb-3">
              <label className="admin-label mb-0">
                Teams &amp; Captains
                <span className="ml-2 font-bold normal-case tracking-normal text-jcc-text-muted">
                  {form.roster.length} teams this season
                </span>
              </label>
              {availableTeams.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {availableTeams.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRoster([...form.roster, { team_id: id, captain: "" }])}
                      className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-jcc-accent/30 text-jcc-accent-dark hover:bg-jcc-accent/10 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {TEAMS[id].name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {form.roster.map((entry, i) => (
                <div
                  key={entry.team_id}
                  className="flex items-center gap-3 rounded-lg border border-jcc-border/60 bg-white/[0.02] px-3 py-2"
                >
                  <span
                    className="w-1.5 h-8 rounded-full shrink-0"
                    style={{ background: TEAMS[entry.team_id].primary }}
                  />
                  <span className="w-32 shrink-0 text-xs font-black uppercase tracking-wide">
                    {TEAMS[entry.team_id].name}
                  </span>
                  <input
                    type="text"
                    className="admin-input flex-1 mt-0!"
                    placeholder={`${TEAMS[entry.team_id].name} captain`}
                    value={entry.captain}
                    onChange={(e) => {
                      const next = [...form.roster];
                      next[i] = { ...next[i], captain: e.target.value };
                      setRoster(next);
                    }}
                  />
                  <button
                    type="button"
                    // Below two teams there is no season to play, so the last
                    // pair can't be removed.
                    disabled={form.roster.length <= 2}
                    onClick={() => setRoster(form.roster.filter((_, j) => j !== i))}
                    title={form.roster.length <= 2 ? "A season needs at least 2 teams" : "Remove team"}
                    className="shrink-0 p-1.5 rounded text-jcc-text-muted hover:text-jcc-danger disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="mt-4 text-[12px] font-black text-jcc-danger uppercase tracking-widest">{error}</p>
          )}
          {successId && (
            <p className="mt-4 text-[12px] font-black text-jcc-accent-dark uppercase tracking-widest">
              Season transitioned successfully.
            </p>
          )}

          <button
            type="button"
            disabled={!canSubmit || saving}
            onClick={() => setConfirmOpen(true)}
            className="mt-6 btn-vibrant-blue text-sm font-black flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Archive &amp; Start New Season
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit}
        variant="danger"
        title="Archive Current Season?"
        description={`This archives "${activeSeason?.title ?? ""}" and makes "${form.title || "the new season"}" the active season. This can't be undone from here.`}
        confirmText="Archive & Create"
      />
    </div>
  );
}
