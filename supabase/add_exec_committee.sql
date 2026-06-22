-- Add executive committee flag to players table.
-- Founding members (member_tag = 'founding-member') are always in the exec committee;
-- this column covers members explicitly added beyond that founding set.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_exec_committee BOOLEAN NOT NULL DEFAULT false;
