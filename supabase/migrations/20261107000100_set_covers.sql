-- One cover picture per set, for the sets browser on the Cards page.
--
-- The official data has no product box art, so a set is shown by its most striking card: a secret
-- rare, else a leader, else a super rare … preferring the set's own cards (OP17-… in OP-17) over the
-- special inserts and reprints sold in the same pack, and alternate arts over base prints.

create function public.set_covers(p_language text)
returns table (set_id text, printing_id text, card_id text, name text, image_url text)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (p.set_id) p.set_id, p.id, p.card_id, p.name, p.image_url
  from public.printings p
  join public.sets s on s.id = p.set_id
  where s.language = p_language
  order by
    p.set_id,
    -- the set's own cards first: "OP-17" → card numbers starting "OP17-"
    (p.card_id like replace(s.code, '-', '') || '-%') desc,
    case p.rarity
      when 'SecretRare' then 0
      when 'Leader' then 1
      when 'SuperRare' then 2
      when 'TreasureRare' then 3
      when 'Special' then 4
      when 'Rare' then 5
      else 9
    end,
    case p.variant when 'parallel' then 0 when 'base' then 1 else 2 end,
    p.card_id,
    p.variant_index
$$;

comment on function public.set_covers(text) is
  'One representative printing per set of the given language (secret rare > leader > super rare …).';

revoke all on function public.set_covers(text) from public;
grant execute on function public.set_covers(text) to anon, authenticated;
