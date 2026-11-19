-- Extend exercise snapshots without rewriting historical attempts.
begin;
create or replace function public.valid_exercise_config(settings jsonb, exercise_module text) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare figure jsonb; expected_length integer; open_note jsonb; previous_note numeric := -1; frets numeric;
begin
  if jsonb_typeof(settings) is distinct from 'object' then return false; end if;
  if jsonb_typeof(settings->'bpm') is distinct from 'number' or jsonb_typeof(settings->'level') is distinct from 'number' then return false; end if;
  if (settings->>'bpm')::numeric not between 40 and 180 or (settings->>'level')::numeric not between 1 and 10 then return false; end if;
  if settings ? 'modality' and (jsonb_typeof(settings->'modality') is distinct from 'string' or settings->>'modality' not in ('ear', 'visual', 'fretboard', 'tab')) then return false; end if;
  if settings ? 'reading' and settings->>'reading' not in ('notes', 'rhythm') then return false; end if;
  -- New fields remain optional: historical attempts are still valid.
  if settings ? 'clef' and (jsonb_typeof(settings->'clef') is distinct from 'string' or settings->>'clef' not in ('bass', 'treble')) then return false; end if;
  if settings ? 'nomenclature' and (jsonb_typeof(settings->'nomenclature') is distinct from 'string' or settings->>'nomenclature' not in ('latin', 'english')) then return false; end if;
  if settings ? 'instrument' then
    if jsonb_typeof(settings->'instrument') is distinct from 'object' then return false; end if;
    if jsonb_typeof(settings->'instrument'->'name') is distinct from 'string' or length(settings->'instrument'->>'name') not between 1 and 200 then return false; end if;
    if jsonb_typeof(settings->'instrument'->'frets') is distinct from 'number' then return false; end if;
    frets := (settings->'instrument'->>'frets')::numeric;
    if frets < 0 or frets > 127 or mod(frets, 1) <> 0 then return false; end if;
    if jsonb_typeof(settings->'instrument'->'strings') is distinct from 'array' then return false; end if;
    if jsonb_array_length(settings->'instrument'->'strings') not between 1 and 128 then return false; end if;
    for open_note in select * from jsonb_array_elements(settings->'instrument'->'strings') loop
      if jsonb_typeof(open_note) is distinct from 'number' then return false; end if;
      if open_note::text::numeric < 0 or open_note::text::numeric + frets > 127 or mod(open_note::text::numeric, 1) <> 0 or open_note::text::numeric < previous_note then return false; end if;
      previous_note := open_note::text::numeric;
    end loop;
  end if;
  if settings ? 'register' then
    if jsonb_typeof(settings->'register') is distinct from 'object' then return false; end if;
    if jsonb_typeof(settings->'register'->'min') is distinct from 'number' or jsonb_typeof(settings->'register'->'max') is distinct from 'number' then return false; end if;
    if (settings->'register'->>'min')::numeric < 0 or (settings->'register'->>'max')::numeric > 127 or (settings->'register'->>'min')::numeric > (settings->'register'->>'max')::numeric or mod((settings->'register'->>'min')::numeric, 1) <> 0 or mod((settings->'register'->>'max')::numeric, 1) <> 0 then return false; end if;
  end if;
  if exercise_module = 'groove' or (exercise_module = 'reading' and settings->>'reading' = 'rhythm') then
    expected_length := case when exercise_module = 'groove' then 16 else 4 end;
    if jsonb_typeof(settings->'pattern') is distinct from 'array' then return false; end if;
    if jsonb_array_length(settings->'pattern') <> expected_length then return false; end if;
    for figure in select * from jsonb_array_elements(settings->'pattern') loop
      if jsonb_typeof(figure) is distinct from 'number' then return false; end if;
      if figure::text::numeric < 0 or figure::text::numeric > 9 or mod(figure::text::numeric, 1) <> 0 then return false; end if;
    end loop;
  end if;
  return true;
end;
$$;

commit;
