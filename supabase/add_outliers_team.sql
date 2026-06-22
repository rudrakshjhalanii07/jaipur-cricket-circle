-- Drop the existing team check constraint (Postgres auto-names it players_team_check)
-- and re-add it with The Outliers included.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.players'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%team%'
  LOOP
    EXECUTE 'ALTER TABLE public.players DROP CONSTRAINT IF EXISTS ' || quote_ident(con.conname);
  END LOOP;
END $$;

ALTER TABLE public.players
  ADD CONSTRAINT players_team_check
  CHECK (team IN ('Mavericks', 'NeuroStrikers', 'The Outliers', 'Unassigned'));
