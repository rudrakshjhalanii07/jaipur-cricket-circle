import { fetchActiveTournament, fetchTournamentMatches } from "@/lib/tournament-data";
import TournamentPageClient from "./TournamentPageClient";

export default async function TournamentPage() {
  const tournament = await fetchActiveTournament();
  const matches = tournament ? await fetchTournamentMatches(tournament.id) : [];

  return (
    <TournamentPageClient
      initialTournament={tournament}
      initialMatches={matches}
    />
  );
}
