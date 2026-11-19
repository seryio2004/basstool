begin;

create or replace function public.valid_chord_train_config(settings jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare item jsonb; beats integer;
begin
  if not public.valid_exercise_config(settings, 'chord-train') then return false; end if;
  if (settings->>'level')::numeric not in (1, 2, 3, 4) then return false; end if;
  if coalesce(settings->>'rhythmInput', '') not in ('manual', 'mic') then return false; end if;
  if jsonb_typeof(settings->'chords') is distinct from 'array' or
     jsonb_typeof(settings->'pattern') is distinct from 'array' then return false; end if;
  beats := jsonb_array_length(settings->'chords');
  if beats not in (16, 48) or jsonb_array_length(settings->'pattern') <> beats then return false; end if;
  for item in select * from jsonb_array_elements(settings->'pattern') loop
    if jsonb_typeof(item) is distinct from 'number' then return false; end if;
    if item::text::numeric not between 0 and 9 or mod(item::text::numeric, 1) <> 0 then return false; end if;
  end loop;
  for item in select * from jsonb_array_elements(settings->'chords') loop
    if jsonb_typeof(item) is distinct from 'string' then return false; end if;
    if item #>> '{}' !~ '^[A-G](##|#|bb|b)?(m|dim|aug|sus2|sus4|7|maj7|m7|m7b5|dim7|mMaj7|augMaj7|6|m6|9|maj9|m9|add9)?$' then return false; end if;
  end loop;
  return true;
end;
$$;

commit;
