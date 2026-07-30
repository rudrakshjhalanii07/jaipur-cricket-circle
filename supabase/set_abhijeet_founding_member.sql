-- Abhijeet Singh Shekhawat is a founding member.
--
-- His `players` row was created through the ordinary registration flow and
-- landed on member_tag = 'member', so /members ranked and badged him as a
-- regular player. Only the membership tag changes here: the governance columns
-- (is_core_committee / is_exec_committee / governance_role) stay untouched, so
-- the About page keeps listing him through HONORARY_GOVERNANCE_MEMBERS in
-- lib/member-role.ts rather than gaining a second, duplicate entry.
--
-- Matched on id, not name — two spellings of a name are a real possibility and
-- an over-broad UPDATE here would silently promote someone else.

UPDATE players
SET member_tag = 'founding-member'
WHERE id = '5637e75a-93b8-4af5-a885-66657db19f6b';
