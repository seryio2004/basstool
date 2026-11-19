begin;

create function public.valid_chord_train_config(settings jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare chord jsonb;
begin
  if not public.valid_exercise_config(settings, 'groove') then return false; end if;
  if (settings->>'level')::numeric not in (1, 2, 3, 4) then return false; end if;
  if coalesce(settings->>'rhythmInput', '') not in ('manual', 'mic') then return false; end if;
  if jsonb_typeof(settings->'chords') is distinct from 'array' then return false; end if;
  if jsonb_array_length(settings->'chords') <> 16 then return false; end if;
  for chord in select * from jsonb_array_elements(settings->'chords') loop
    if jsonb_typeof(chord) is distinct from 'string' then return false; end if;
    if chord #>> '{}' !~ '^[A-G][#b]?(m|dim|aug|sus2|sus4|7|maj7|m7|m7b5|dim7|mMaj7|augMaj7)?$' then return false; end if;
  end loop;
  return true;
end;
$$;

alter table public.attempts drop constraint attempts_module_check;
alter table public.attempts
  add constraint attempts_module_check check (module in ('groove', 'notes', 'intervals', 'reading', 'chord-train')),
  add constraint attempts_chord_train_check check (module <> 'chord-train' or public.valid_chord_train_config(config));

commit;
