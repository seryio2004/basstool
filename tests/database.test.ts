import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

test('Supabase migration isolates each bassist, keeps attempts immutable and deletes accounts', async () => {
  const db = new PGlite();
  try {
    // Emulate only the Supabase Auth boundary; all application tables and RLS
    // below come from the shipping migration, executed by PostgreSQL itself.
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text not null, raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to authenticated;
      grant execute on function auth.uid() to authenticated;
    `);
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202611190001_initial.sql', import.meta.url),
        'utf8',
      ),
    );
    const alice = '00000000-0000-4000-8000-000000000001',
      bob = '00000000-0000-4000-8000-000000000002';
    for (const [id, email] of [
      [alice, 'alice@test.com'],
      [bob, 'bob@test.com'],
    ]) {
      await db.query('insert into auth.users(id,email) values ($1,$2)', [id, email]);
    }
    const as = async (id: string) => {
      await db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role authenticated;`);
    };

    // Signup creates a default bass profile.
    await as(alice);
    const own = await db.query<{ tuning: string; configured: boolean }>(
      'select tuning, configured from public.profiles',
    );
    assert.deepEqual(own.rows, [{ tuning: 'standard4', configured: false }]);

    // Instrument settings are editable; identity and unknown tunings are not.
    await db.query(
      "update public.profiles set tuning='standard5', left_handed=true, configured=true where id=$1",
      [alice],
    );
    await assert.rejects(
      db.query("update public.profiles set email='x@test.com' where id=$1", [alice]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("update public.profiles set tuning='guitar' where id=$1", [alice]),
      /check constraint/,
    );

    // Attempts: own rows only, idempotent retries, valid config, no edits.
    const attempt = '00000000-0000-4000-8000-000000000030';
    const config = { bpm: 90, level: 1, modality: 'visual', reading: 'notes' };
    for (let retry = 0; retry < 2; retry++) {
      await db.query(
        'insert into public.attempts(id,user_id,module,correct,total,score,duration,config) values ($1,$2,$3,7,8,88,25,$4) on conflict (id) do nothing',
        [attempt, alice, 'notes', config],
      );
    }
    assert.equal((await db.query('select * from public.attempts')).rows.length, 1);
    await assert.rejects(
      db.query(
        'insert into public.attempts(user_id,module,correct,total,score,duration,config) values ($1,$2,7,8,88,25,$3)',
        [bob, 'notes', config],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        'insert into public.attempts(user_id,module,correct,total,score,duration,config) values ($1,$2,1,1,100,5,$3)',
        [alice, 'groove', { bpm: 90, level: 1, pattern: [50] }],
      ),
      /check constraint/,
    );
    await assert.rejects(db.query('update public.attempts set score=100'), /permission denied/);
    await assert.rejects(db.query('delete from public.attempts'), /permission denied/);

    // Course progress keeps its validation.
    const answers = {
      'harmony-01-q1': 'Dos pulsos',
      'harmony-01-q2': 'Sol4',
      'harmony-01-q3': 'La presencia de sonido, no la duración',
    };
    const work = {
      'harmony-01-p1': {
        text: 'He identificado las notas en ambas claves y las he tocado despacio.',
        checks: ['0', '1', '2'],
        selfAssessed: true,
      },
    };
    await db.query(
      'insert into public.lesson_progress(user_id,course_id,lesson_id,quiz_answers,quiz_submitted,practical) values ($1,$2,$3,$4,true,$5)',
      [alice, 'harmony-1', 'harmony-01', answers, work],
    );
    await assert.rejects(
      db.query(
        'insert into public.lesson_progress(user_id,course_id,lesson_id,quiz_submitted) values ($1,$2,$3,true)',
        [alice, 'harmony-1', 'harmony-02'],
      ),
      /check constraint/,
    );

    // Another user sees and changes nothing of Alice's.
    await as(bob);
    for (const table of ['profiles', 'attempts', 'lesson_progress']) {
      const rows = (await db.query<{ n: number }>(`select count(*)::int n from public.${table}`))
        .rows[0]!.n;
      assert.equal(rows, table === 'profiles' ? 1 : 0, table);
    }
    assert.equal(
      (
        await db.query("update public.profiles set level='advanced' where id=$1 returning *", [
          alice,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query('update public.lesson_progress set quiz_submitted=false returning *')).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query(
        'insert into public.lesson_progress(user_id,course_id,lesson_id) values ($1,$2,$3)',
        [alice, 'harmony-1', 'harmony-03'],
      ),
      /row-level security/,
    );

    // Anonymous visitors have no access at all.
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.profiles'), /permission denied/);

    // Account deletion removes the user and every row of theirs, not other users'.
    await as(alice);
    await db.query('select public.delete_own_account()');
    await db.exec('reset role;');
    assert.equal((await db.query('select * from auth.users where id=$1', [alice])).rows.length, 0);
    for (const table of ['profiles', 'attempts', 'lesson_progress']) {
      const rows = (
        await db.query<{ n: number }>(
          `select count(*)::int n from public.${table} where ${table === 'profiles' ? 'id' : 'user_id'}=$1`,
          [alice],
        )
      ).rows[0]!.n;
      assert.equal(rows, 0, table);
    }
    assert.equal(
      (await db.query('select * from public.profiles where id=$1', [bob])).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
