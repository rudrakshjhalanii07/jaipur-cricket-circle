-- Fold the About page's hardcoded Core/Executive Committee roster into the
-- players table, so governance role has one source of truth alongside
-- member_tag / group_role instead of a separate hardcoded array in
-- app/about/page.tsx.
--
-- governance_role: the person's seat on the committee ('co-founder' for the
-- five original founders, 'permanent-member' for others granted a permanent
-- exec seat). NULL for everyone else.
--
-- is_core_committee: true for the Core Committee (the founding five) — the
-- highest governing body. Distinct from is_exec_committee (added in
-- add_exec_committee.sql), which is the broader operational leadership body;
-- every Core Committee member is also on the Executive Committee, so this
-- migration backfills is_exec_committee = true for them too.
--
-- governance_order: stable display order for the About page committee grids
-- (mirrors the order of the old hardcoded CORE_COMMITTEE / EXEC_ONLY arrays).
-- Captaincy itself is NOT duplicated here — it already lives on group_role
-- ('captain'), which is the same field the homepage/Members pages use.
--
-- Note: one Core Committee co-founder, Abhijeet Singh Shekhawat, has no
-- corresponding row in `players` (no phone number on file, and phone is
-- NOT NULL UNIQUE) — he stays a documented exception in
-- lib/member-role.ts's HONORARY_GOVERNANCE_MEMBERS rather than a fabricated
-- player record.

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS governance_role TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_core_committee BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS governance_order SMALLINT;

-- Core Committee (co-founders)
UPDATE public.players SET governance_role = 'co-founder', is_core_committee = true, is_exec_committee = true, governance_order = 1 WHERE id = '36627128-46d8-4daf-9414-0995bb2eee28'; -- Opal
UPDATE public.players SET governance_role = 'co-founder', is_core_committee = true, is_exec_committee = true, governance_order = 2 WHERE id = 'b889a8b9-ac60-4466-9425-d944df2a436c'; -- Nitin Setia
UPDATE public.players SET governance_role = 'co-founder', is_core_committee = true, is_exec_committee = true, governance_order = 3 WHERE id = '77d8c607-4fc9-4f9e-9b64-7a614728e3b1'; -- Sagar Sharma
UPDATE public.players SET governance_role = 'co-founder', is_core_committee = true, is_exec_committee = true, governance_order = 4 WHERE id = '45d81ab7-1668-40d9-8ce1-30dc0f756817'; -- Nitesh Jhurani

-- Executive Committee only (permanent members, not founders)
UPDATE public.players SET governance_role = 'permanent-member', governance_order = 6 WHERE id = '2a930e74-265a-43a5-9e37-951637b864d4'; -- Anil Rawat
UPDATE public.players SET governance_role = 'permanent-member', governance_order = 7 WHERE id = '0642b6bf-e908-4e1a-bfdd-cbcc94a74f31'; -- Rudraksh Jhalani
