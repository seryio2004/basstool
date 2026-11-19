begin;

alter table public.attempts drop constraint attempts_module_check;
alter table public.attempts
  add constraint attempts_module_check check (module in (
    'groove', 'notes', 'intervals', 'reading', 'chord-train', 'listen-repeat'
  )),
  add constraint attempts_listen_repeat_check check (
    module <> 'listen-repeat' or coalesce(
      jsonb_typeof(config->'listenRepeat') = 'object'
      and config->'listenRepeat'->>'genre' in ('rock', 'funk', 'blues', 'reggae', 'latin', 'jazz')
      and config->'listenRepeat'->>'difficulty' in ('beginner', 'intermediate', 'advanced')
      and jsonb_typeof(config->'listenRepeat'->'chords') = 'boolean'
      and config->'listenRepeat'->>'input' in ('manual', 'mic')
      and case when jsonb_typeof(config->'listenRepeat'->'seed') = 'number' then
        (config->'listenRepeat'->>'seed')::numeric between 0 and 4294967295
        and mod((config->'listenRepeat'->>'seed')::numeric, 1) = 0
      else false end,
      false
    )
  );

commit;
