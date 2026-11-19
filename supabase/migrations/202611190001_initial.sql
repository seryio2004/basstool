-- Esquema inicial de clasRo: app de estudio para bajistas.
-- Cada fila pertenece a una persona y solo ella puede leerla o escribirla.
-- Aplicar en un proyecto Supabase nuevo.
begin;

create function public.valid_exercise_config(settings jsonb, exercise_module text) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare figure jsonb; expected_length integer;
begin
  if jsonb_typeof(settings) is distinct from 'object' then return false; end if;
  if jsonb_typeof(settings->'bpm') is distinct from 'number' or jsonb_typeof(settings->'level') is distinct from 'number' then return false; end if;
  if (settings->>'bpm')::numeric not between 40 and 180 or (settings->>'level')::numeric not between 1 and 10 then return false; end if;
  if settings ? 'modality' and settings->>'modality' not in ('ear', 'visual') then return false; end if;
  if settings ? 'reading' and settings->>'reading' not in ('notes', 'rhythm') then return false; end if;
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

create function public.valid_harmony_progress(target text, answers jsonb, submitted boolean, work jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare entry record; response jsonb; item jsonb; answer_count integer := 0; practice_count integer := 0;
begin
  if jsonb_typeof(answers) is distinct from 'object' or jsonb_typeof(work) is distinct from 'object' then return false; end if;
  for entry in select * from jsonb_each(answers) loop
    answer_count := answer_count + 1;
    if entry.key not in (target || '-q1', target || '-q2', target || '-q3') or jsonb_typeof(entry.value) is distinct from 'string' or length(entry.value::text) > 1000 then return false; end if;
  end loop;
  if submitted and answer_count <> 3 then return false; end if;
  for entry in select * from jsonb_each(work) loop
    practice_count := practice_count + 1; response := entry.value;
    if entry.key not in (target || '-p1', target || '-p2') or jsonb_typeof(response) is distinct from 'object' then return false; end if;
    if jsonb_typeof(response->'text') is distinct from 'string' or length(response->>'text') > 10000 then return false; end if;
    if jsonb_typeof(response->'selfAssessed') is distinct from 'boolean' or jsonb_typeof(response->'checks') is distinct from 'array' then return false; end if;
    if jsonb_array_length(response->'checks') > 3 then return false; end if;
    for item in select * from jsonb_array_elements(response->'checks') loop
      if item not in ('"0"'::jsonb, '"1"'::jsonb, '"2"'::jsonb) then return false; end if;
    end loop;
    if (response->>'selfAssessed')::boolean and (length(trim(response->>'text')) < 20 or not (response->'checks' @> '["0","1","2"]'::jsonb)) then return false; end if;
  end loop;
  return answer_count <= 3 and practice_count <= 2;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  tuning text not null default 'standard4'
    check (tuning in ('standard4', 'standard5', 'standard6', 'dropD', 'halfStepDown')),
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  nomenclature text not null default 'latin' check (nomenclature in ('latin', 'english')),
  left_handed boolean not null default false,
  configured boolean not null default false,
  created_at timestamptz not null default now()
);

-- Intentos de práctica. Inmutables: la configuración guardada no cambia después.
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null check (module in ('groove', 'notes', 'intervals', 'reading')),
  correct integer not null check (correct >= 0),
  total integer not null check (total between 1 and 10000 and correct <= total),
  score integer not null check (score = round(correct::numeric / total * 100)),
  duration integer not null check (duration between 0 and 86400),
  config jsonb not null check (public.valid_exercise_config(config, module)),
  detail text not null default '' check (length(detail) <= 2000),
  created_at timestamptz not null default now()
);
create index attempts_user_idx on public.attempts(user_id, created_at desc);

create table public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null check (course_id = 'harmony-1'),
  lesson_id text not null check (lesson_id ~ '^harmony-(0[1-9]|[12][0-9]|3[0-2])$'),
  quiz_answers jsonb not null default '{}',
  quiz_submitted boolean not null default false,
  practical jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key(user_id, course_id, lesson_id),
  check (public.valid_harmony_progress(lesson_id, quiz_answers, quiz_submitted, practical))
);

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;
alter table public.lesson_progress enable row level security;

create policy profiles_own_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy attempts_own_read on public.attempts for select to authenticated using (user_id = auth.uid());
create policy attempts_own_create on public.attempts for insert to authenticated with check (user_id = auth.uid());
create policy lesson_progress_own_read on public.lesson_progress for select to authenticated using (user_id = auth.uid());
create policy lesson_progress_own_create on public.lesson_progress for insert to authenticated with check (user_id = auth.uid());
create policy lesson_progress_own_update on public.lesson_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sin acceso anónimo. El perfil solo permite cambiar los ajustes del instrumento;
-- el correo y el id los gestiona Auth.
revoke all on public.profiles, public.attempts, public.lesson_progress from anon, authenticated;
grant select on public.profiles, public.attempts, public.lesson_progress to authenticated;
grant update (tuning, level, nomenclature, left_handed, configured) on public.profiles to authenticated;
grant insert on public.attempts to authenticated;
grant insert, update on public.lesson_progress to authenticated;

create function public.touch_lesson_progress() returns trigger
language plpgsql set search_path = public, pg_temp as $$ begin new.updated_at := now(); return new; end; $$;
revoke all on function public.touch_lesson_progress() from public;
create trigger touch_lesson_progress before insert or update on public.lesson_progress
  for each row execute function public.touch_lesson_progress();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into profiles(id, email) values (new.id, new.email);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Eliminación de la cuenta desde la app (exigida por App Store y Google Play).
-- Borra el usuario de Auth; perfil, intentos y progreso se eliminan en cascada.
create function public.delete_own_account() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'No hay ninguna sesión iniciada.'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

commit;
