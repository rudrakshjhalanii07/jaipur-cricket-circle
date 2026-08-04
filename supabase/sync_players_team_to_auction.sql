-- ============================================================
-- Sync `players.team` to the Season 3 auction sheet. Run in the Supabase SQL editor.
--
-- scripts/season-3-auction.json is the standard reference for who is on which
-- team in Season 3 — it is the record of the event that decided it. The
-- `players.team` column predates the auction: it carried Season 2 sides and was
-- only ever edited by hand. By 2026-08-04, of the 38 members bought at the
-- auction it was null for 25, held last season's side for 8 (Anil Rawat,
-- Jaivardhan Pathak, Sarthak S Rathore, Nitin Setia, Vaibhav Asudani, and
-- Bhairav Deep, Opal and Prashant Ramchandani, all three still NeuroStrikers
-- after moving to the Vikings), and was already right for 5.
--
-- The pairing was made with the same loose matcher /members uses
-- (createRosterMatcher over playerPhotoKeys), then written out row-by-row by id
-- so this file cannot re-resolve a name differently later. Every one of the 38
-- `member: true` signings matched a roster row.
--
-- Not touched, deliberately:
--   • members nobody bought (RAM HALDIA, Abdur zyaad, Chaitanya saran,
--     Ishdeep Singh Chhabra) — they keep whatever the roster says;
--   • `member: false` signings, who have no roster row by definition.
--
-- This changes no leaderboard number. /members already derives the current side
-- from the season itself (see teamsByMember in app/members/page.tsx, where the
-- auction outranks the roster column); this makes the stored column agree with
-- what the site already shows, for the admin panel and the profile pages that
-- read it raw.
--
-- Safe to run more than once — each statement sets an absolute value.
-- ============================================================

BEGIN;

-- What is about to change — read this before committing.
SELECT id, name, team AS current_team
FROM public.players
WHERE id IN (
  '2c9fa095-8861-4239-8521-d27d15a74346',
  '2a930e74-265a-43a5-9e37-951637b864d4',
  '0ebac9b1-2e38-42a8-a504-9c271c518b7b',
  'f2313bdc-11cd-48f3-89ef-060a96180e87',
  '27153706-aaef-4133-915f-885867495aaa',
  'bf41a254-7dba-4e8b-a7df-66cb684d89f9',
  '21f8fce6-7558-4017-8a9e-b368455207a0',
  '5637e75a-93b8-4af5-a885-66657db19f6b',
  'e57c378b-93b7-4568-a053-b30e24676358',
  'ac89ddd0-12ea-4276-81e0-2925283b7d03',
  '75cead4c-1610-484f-a66e-df3f6a2e802e',
  '67b58c39-e46d-42df-9210-a0b33013602d',
  '1234bb68-85f5-43ba-8be3-11876465cd9c',
  'ec599818-fbfa-4b98-a4b9-9247a1de4af2',
  'd38b81a3-9ca9-4f0f-aa38-ff14d0ad6207',
  'a94ec800-1da6-443e-ae34-61434f106227',
  'b889a8b9-ac60-4466-9425-d944df2a436c',
  '41c808c0-f30e-4035-a773-aadf7c8cfd6e',
  '93db98b7-0a50-49f2-80b9-74cbc18031d8',
  '0ecdc2e0-eb7d-431e-8b12-09049243c61d',
  '71056fec-7efd-49bd-b01f-a4ca9a3ce0da',
  'e28d6e0b-7e86-41f0-95fb-6573615fbc08',
  '8b1746be-cb5c-4a6c-aac4-dd7f5179237c',
  '09223494-c56d-4bfe-9d63-bd4d921b7693',
  '56c895e9-9fe4-41c6-988b-5f53d9b92c37',
  'a56f2211-d4a3-4578-b294-f44788e5db2d',
  '59ff4e9d-03e9-4dd1-b3e4-440fcb441483',
  '9004ae86-26e8-4985-bbfb-dc2b3c4ac669',
  '25ac3c3e-5437-43f9-97db-24aa31b1ba35',
  '36627128-46d8-4daf-9414-0995bb2eee28',
  '2939ccb1-1be7-4d2f-993f-62af86d999a2',
  '2e3e6893-6ae9-46f5-9d95-608ce508b1aa',
  '7192c5db-bf12-472c-9089-75c0a4c2a7c3'
)
ORDER BY team NULLS FIRST, name;

UPDATE public.players SET team = 'NeuroStrikers' WHERE id = '2c9fa095-8861-4239-8521-d27d15a74346';  -- Saurabh Charan: (null) -> NeuroStrikers
UPDATE public.players SET team = 'NeuroStrikers' WHERE id = '2a930e74-265a-43a5-9e37-951637b864d4';  -- Anil Rawat: Mavericks -> NeuroStrikers
UPDATE public.players SET team = 'NeuroStrikers' WHERE id = '0ebac9b1-2e38-42a8-a504-9c271c518b7b';  -- Dhruv paliwal: (null) -> NeuroStrikers
UPDATE public.players SET team = 'NeuroStrikers' WHERE id = 'f2313bdc-11cd-48f3-89ef-060a96180e87';  -- Kunwar gaurav: (null) -> NeuroStrikers
UPDATE public.players SET team = 'NeuroStrikers' WHERE id = '27153706-aaef-4133-915f-885867495aaa';  -- Rahul Kasliwal: (null) -> NeuroStrikers
UPDATE public.players SET team = 'NeuroStrikers' WHERE id = 'bf41a254-7dba-4e8b-a7df-66cb684d89f9';  -- Vikas Majoka: (null) -> NeuroStrikers
UPDATE public.players SET team = 'Mavericks' WHERE id = '21f8fce6-7558-4017-8a9e-b368455207a0';  -- Harish Jangid: (null) -> Mavericks
UPDATE public.players SET team = 'Mavericks' WHERE id = '5637e75a-93b8-4af5-a885-66657db19f6b';  -- Abhijeet Singh Shekhawat: (null) -> Mavericks
UPDATE public.players SET team = 'Mavericks' WHERE id = 'e57c378b-93b7-4568-a053-b30e24676358';  -- Jaivardhan Pathak: The Outliers -> Mavericks
UPDATE public.players SET team = 'Mavericks' WHERE id = 'ac89ddd0-12ea-4276-81e0-2925283b7d03';  -- Ankit Jain: (null) -> Mavericks
UPDATE public.players SET team = 'Mavericks' WHERE id = '75cead4c-1610-484f-a66e-df3f6a2e802e';  -- Lakshya Sharma: (null) -> Mavericks
UPDATE public.players SET team = 'Mavericks' WHERE id = '67b58c39-e46d-42df-9210-a0b33013602d';  -- Sarthak S Rathore: NeuroStrikers -> Mavericks
UPDATE public.players SET team = 'The Outliers' WHERE id = '1234bb68-85f5-43ba-8be3-11876465cd9c';  -- Siddharth Rao: (null) -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = 'ec599818-fbfa-4b98-a4b9-9247a1de4af2';  -- Harnoor Singh: (null) -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = 'd38b81a3-9ca9-4f0f-aa38-ff14d0ad6207';  -- Satvik Todwal: (null) -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = 'a94ec800-1da6-443e-ae34-61434f106227';  -- Krishna saxena: (null) -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = 'b889a8b9-ac60-4466-9425-d944df2a436c';  -- Nitin Setia: Mavericks -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = '41c808c0-f30e-4035-a773-aadf7c8cfd6e';  -- Vaibhav Asudani: NeuroStrikers -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = '93db98b7-0a50-49f2-80b9-74cbc18031d8';  -- Madhav Sharma: (null) -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = '0ecdc2e0-eb7d-431e-8b12-09049243c61d';  -- Shrikant: (null) -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = '71056fec-7efd-49bd-b01f-a4ca9a3ce0da';  -- Naman Mittal: (null) -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = 'e28d6e0b-7e86-41f0-95fb-6573615fbc08';  -- Gaurang Dixit: (null) -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = '8b1746be-cb5c-4a6c-aac4-dd7f5179237c';  -- Karandeep Singh Kamboj : (null) -> The Outliers
UPDATE public.players SET team = 'The Outliers' WHERE id = '09223494-c56d-4bfe-9d63-bd4d921b7693';  -- Sameer Saifi: (null) -> The Outliers
UPDATE public.players SET team = 'Vikings' WHERE id = '56c895e9-9fe4-41c6-988b-5f53d9b92c37';  -- BHAIRAV DEEP: NeuroStrikers -> Vikings
UPDATE public.players SET team = 'Vikings' WHERE id = 'a56f2211-d4a3-4578-b294-f44788e5db2d';  -- Mahesh kumar: (null) -> Vikings
UPDATE public.players SET team = 'Vikings' WHERE id = '59ff4e9d-03e9-4dd1-b3e4-440fcb441483';  -- Nishant Gupta: (null) -> Vikings
UPDATE public.players SET team = 'Vikings' WHERE id = '9004ae86-26e8-4985-bbfb-dc2b3c4ac669';  -- navin gurjar: (null) -> Vikings
UPDATE public.players SET team = 'Vikings' WHERE id = '25ac3c3e-5437-43f9-97db-24aa31b1ba35';  -- Yash Pareek: (null) -> Vikings
UPDATE public.players SET team = 'Vikings' WHERE id = '36627128-46d8-4daf-9414-0995bb2eee28';  -- Opal: NeuroStrikers -> Vikings
UPDATE public.players SET team = 'Vikings' WHERE id = '2939ccb1-1be7-4d2f-993f-62af86d999a2';  -- Anagh Nandwana: (null) -> Vikings
UPDATE public.players SET team = 'Vikings' WHERE id = '2e3e6893-6ae9-46f5-9d95-608ce508b1aa';  -- Prashant Ramchandani: NeuroStrikers -> Vikings
UPDATE public.players SET team = 'Vikings' WHERE id = '7192c5db-bf12-472c-9089-75c0a4c2a7c3';  -- imran: (null) -> Vikings

-- Every row touched should now sit on its auction side: four teams, no NULL,
-- summing to the 33 rows above. Each team's count is the members among the
-- 13/14/17/13 it bought — the rest of each sheet is non-members, who have no
-- roster row to carry a team.
SELECT team, count(*) AS members
FROM public.players
WHERE id IN (
  '2c9fa095-8861-4239-8521-d27d15a74346',
  '2a930e74-265a-43a5-9e37-951637b864d4',
  '0ebac9b1-2e38-42a8-a504-9c271c518b7b',
  'f2313bdc-11cd-48f3-89ef-060a96180e87',
  '27153706-aaef-4133-915f-885867495aaa',
  'bf41a254-7dba-4e8b-a7df-66cb684d89f9',
  '21f8fce6-7558-4017-8a9e-b368455207a0',
  '5637e75a-93b8-4af5-a885-66657db19f6b',
  'e57c378b-93b7-4568-a053-b30e24676358',
  'ac89ddd0-12ea-4276-81e0-2925283b7d03',
  '75cead4c-1610-484f-a66e-df3f6a2e802e',
  '67b58c39-e46d-42df-9210-a0b33013602d',
  '1234bb68-85f5-43ba-8be3-11876465cd9c',
  'ec599818-fbfa-4b98-a4b9-9247a1de4af2',
  'd38b81a3-9ca9-4f0f-aa38-ff14d0ad6207',
  'a94ec800-1da6-443e-ae34-61434f106227',
  'b889a8b9-ac60-4466-9425-d944df2a436c',
  '41c808c0-f30e-4035-a773-aadf7c8cfd6e',
  '93db98b7-0a50-49f2-80b9-74cbc18031d8',
  '0ecdc2e0-eb7d-431e-8b12-09049243c61d',
  '71056fec-7efd-49bd-b01f-a4ca9a3ce0da',
  'e28d6e0b-7e86-41f0-95fb-6573615fbc08',
  '8b1746be-cb5c-4a6c-aac4-dd7f5179237c',
  '09223494-c56d-4bfe-9d63-bd4d921b7693',
  '56c895e9-9fe4-41c6-988b-5f53d9b92c37',
  'a56f2211-d4a3-4578-b294-f44788e5db2d',
  '59ff4e9d-03e9-4dd1-b3e4-440fcb441483',
  '9004ae86-26e8-4985-bbfb-dc2b3c4ac669',
  '25ac3c3e-5437-43f9-97db-24aa31b1ba35',
  '36627128-46d8-4daf-9414-0995bb2eee28',
  '2939ccb1-1be7-4d2f-993f-62af86d999a2',
  '2e3e6893-6ae9-46f5-9d95-608ce508b1aa',
  '7192c5db-bf12-472c-9089-75c0a4c2a7c3'
)
GROUP BY team
ORDER BY team;

COMMIT;
