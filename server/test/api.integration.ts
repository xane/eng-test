import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql, eq } from "drizzle-orm";
import { connect } from "../src/db/connection.js";
import { buildApp } from "../src/app.js";
import { rounds, scores, users, sessions } from "../src/db/schema.js";
import type { Config } from "../src/config.js";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "Set TEST_DATABASE_URL to a dedicated PostgreSQL database whose name ends in _test. Tests reset its tables.",
  );
const first = connect(url),
  second = connect(url);
const config: Config = {
  DATABASE_URL: url,
  PORT: 3000,
  HOST: "127.0.0.1",
  ROUND_DURATION: 60,
  COOLDOWN_DURATION: 30,
  COOKIE_SECURE: false,
};
const apps = await Promise.all([
  buildApp(first.db, config, { logger: false }),
  buildApp(second.db, config, { logger: false }),
]);
before(async () => {
  await migrate(first.db, { migrationsFolder: "server/drizzle" });
  await first.db.execute(sql`truncate scores, sessions, rounds, users cascade`);
  await Promise.all(apps.map((app) => app.ready()));
});
after(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await Promise.all([first.pool.end(), second.pool.end()]);
});
const name = () => `t-${randomUUID()}`;
async function login(
  username = name(),
  password = "test-password",
  instance = 0,
) {
  const response = await apps[instance]!.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password },
  });
  assert.equal(response.statusCode, 200, response.body);
  return {
    user: response.json<{ id: string; username: string; role: string }>(),
    cookie: response.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    response,
  };
}
async function fixture(state: "active" | "scheduled" | "finished" = "active") {
  const [round] = await first.db
    .insert(rounds)
    .values({
      createdAt: sql`clock_timestamp() - interval '2 hours'`,
      startsAt:
        state === "scheduled"
          ? sql`clock_timestamp() + interval '1 hour'`
          : sql`clock_timestamp() - interval '1 hour'`,
      endsAt:
        state === "finished"
          ? sql`clock_timestamp() - interval '1 minute'`
          : sql`clock_timestamp() + interval '2 hours'`,
    })
    .returning();
  return round!;
}
const tap = (id: string, cookie: string, instance = 0) =>
  apps[instance]!.inject({
    method: "POST",
    url: `/api/rounds/${id}/taps`,
    headers: { cookie },
    payload: {},
  });
const detail = (id: string, cookie: string, instance = 0) =>
  apps[instance]!.inject({ url: `/api/rounds/${id}`, headers: { cookie } });
test("registration, HttpOnly session, cross-instance login, bad password, revocation", async () => {
  const user = await login();
  assert.match(String(user.response.headers["set-cookie"]), /HttpOnly/i);
  assert.match(String(user.response.headers["set-cookie"]), /SameSite=Strict/i);
  assert.equal(
    (
      await apps[1]!.inject({
        url: "/api/auth/me",
        headers: { cookie: user.cookie },
      })
    ).json().id,
    user.user.id,
  );
  const bad = await apps[0]!.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: user.user.username, password: "wrong" },
  });
  assert.equal(bad.statusCode, 401);
  const [stored] = await first.db
    .select()
    .from(users)
    .where(eq(users.id, user.user.id));
  assert.notEqual(stored!.passwordHash, "test-password");
  await apps[1]!.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { cookie: user.cookie },
    payload: {},
  });
  assert.equal(
    (
      await apps[0]!.inject({
        url: "/api/auth/me",
        headers: { cookie: user.cookie },
      })
    ).statusCode,
    401,
  );
});
test("simultaneous registration is unique and verifies the winning password", async () => {
  const username = name();
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      login(username, "same-password", i % 2),
    ),
  );
  assert.equal(new Set(results.map((r) => r.user.id)).size, 1);
  const count = await first.db
    .select()
    .from(users)
    .where(eq(users.username, username));
  assert.equal(count.length, 1);
});
test("validation and authorization stay on the server", async () => {
  assert.equal((await apps[0]!.inject({ url: "/api/rounds" })).statusCode, 401);
  assert.equal(
    (
      await apps[0]!.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { username: "   ", password: "x" },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await apps[0]!.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { "content-type": "text/plain" },
        payload: "abc",
      })
    ).statusCode,
    415,
  );
  const user = await login();
  assert.equal(
    (
      await apps[0]!.inject({
        method: "POST",
        url: "/api/rounds",
        headers: { cookie: user.cookie },
        payload: {},
      })
    ).statusCode,
    403,
  );
  assert.equal((await detail("not-a-uuid", user.cookie)).statusCode, 400);
  assert.equal((await detail(randomUUID(), user.cookie)).statusCode, 404);
  assert.equal((await tap(randomUUID(), user.cookie)).statusCode, 404);
});
test("admin creates configured round and list excludes completed rounds", async () => {
  const admin = await login("admin");
  const response = await apps[1]!.inject({
    method: "POST",
    url: "/api/rounds",
    headers: { cookie: admin.cookie },
    payload: {},
  });
  assert.equal(response.statusCode, 201, response.body);
  const round = response.json();
  assert.equal(Date.parse(round.startsAt) - Date.parse(round.createdAt), 30000);
  assert.equal(Date.parse(round.endsAt) - Date.parse(round.startsAt), 60000);
  const finished = await fixture("finished");
  const list = await apps[0]!.inject({
    url: "/api/rounds",
    headers: { cookie: admin.cookie },
  });
  assert.ok(list.json().some((r: { id: string }) => r.id === round.id));
  assert.ok(!list.json().some((r: { id: string }) => r.id === finished.id));
});
test("parallel taps through two independent backend pools preserve bonuses and totals", async () => {
  const a = await login(),
    b = await login(),
    nikita = await login("Никита");
  const round = await fixture();
  const requests = [
    ...Array.from({ length: 110 }, (_, i) => tap(round.id, a.cookie, i % 2)),
    ...Array.from({ length: 33 }, (_, i) => tap(round.id, b.cookie, i % 2)),
    ...Array.from({ length: 22 }, (_, i) =>
      tap(round.id, nikita.cookie, i % 2),
    ),
  ];
  const responses = await Promise.all(requests);
  for (const response of responses)
    assert.equal(response.statusCode, 200, response.body);
  const mine = (await detail(round.id, a.cookie)).json();
  assert.deepEqual(mine.mine, { taps: 110, score: 200 });
  assert.equal(mine.totalScore, 260);
  assert.deepEqual((await detail(round.id, b.cookie, 1)).json().mine, {
    taps: 33,
    score: 60,
  });
  assert.deepEqual((await detail(round.id, nikita.cookie)).json().mine, {
    taps: 0,
    score: 0,
  });
  await first.db
    .update(rounds)
    .set({ endsAt: sql`clock_timestamp() - interval '1 second'` })
    .where(eq(rounds.id, round.id));
  const ended = (await detail(round.id, b.cookie)).json();
  assert.equal(ended.status, "finished");
  assert.equal(ended.winner.id, a.user.id);
  assert.equal(ended.winner.score, 200);
});
test("11th tap is worth 10, other taps worth 1", async () => {
  const user = await login();
  const round = await fixture();
  for (let i = 1; i <= 23; i++) {
    const response = await tap(round.id, user.cookie, i % 2);
    assert.equal(response.json().score, i + 9 * Math.floor(i / 11));
  }
});
test("scheduled and finished rounds reject taps, including Nikita", async () => {
  const user = await login(),
    nikita = await login("Никита");
  for (const state of ["scheduled", "finished"] as const) {
    const round = await fixture(state);
    for (const cookie of [user.cookie, nikita.cookie])
      assert.equal((await tap(round.id, cookie)).statusCode, 409);
    assert.equal((await detail(round.id, user.cookie)).json().totalScore, 0);
  }
});
test("request waiting on a DB lock rechecks actual time after acquiring it", async () => {
  const user = await login();
  const round = await fixture();
  const holder = await first.pool.connect();
  try {
    await holder.query("BEGIN");
    await holder.query(
      "UPDATE rounds SET ends_at=clock_timestamp()+interval '200 milliseconds' WHERE id=$1",
      [round.id],
    );
    const responsePromise = tap(round.id, user.cookie, 1);
    await holder.query("SELECT pg_sleep(0.4)");
    await holder.query("COMMIT");
    const response = await responsePromise;
    assert.equal(response.statusCode, 409, response.body);
    assert.equal((await detail(round.id, user.cookie)).json().totalScore, 0);
  } finally {
    await holder.query("ROLLBACK");
    holder.release();
  }
});
test("failure updating aggregate rolls back personal score in the same transaction", async () => {
  const user = await login();
  const round = await fixture();
  await first.pool.query(
    "CREATE FUNCTION reject_test_total() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$",
  );
  await first.pool.query(
    `CREATE TRIGGER reject_test_total BEFORE UPDATE OF total_score ON rounds FOR EACH ROW WHEN (NEW.id = '${round.id}'::uuid) EXECUTE FUNCTION reject_test_total()`,
  );
  try {
    assert.equal((await tap(round.id, user.cookie)).statusCode, 500);
    assert.deepEqual((await detail(round.id, user.cookie)).json().mine, {
      taps: 0,
      score: 0,
    });
    assert.equal((await detail(round.id, user.cookie)).json().totalScore, 0);
  } finally {
    await first.pool.query("DROP TRIGGER reject_test_total ON rounds");
    await first.pool.query("DROP FUNCTION reject_test_total()");
  }
});
test("no positive score means no winner; ties resolve deterministically by username then id", async () => {
  const a = await login("Аня"),
    b = await login("Борис");
  const empty = await fixture("finished");
  assert.equal((await detail(empty.id, a.cookie)).json().winner, null);
  const round = await fixture();
  await tap(round.id, b.cookie);
  await tap(round.id, a.cookie);
  await first.db
    .update(rounds)
    .set({ endsAt: sql`clock_timestamp() - interval '1 second'` })
    .where(eq(rounds.id, round.id));
  assert.equal(
    (await detail(round.id, b.cookie)).json().winner.username,
    "Аня",
  );
});
test("expired sessions cannot access API", async () => {
  const user = await login();
  await first.db
    .update(sessions)
    .set({ expiresAt: sql`clock_timestamp()-interval '1 second'` })
    .where(eq(sessions.userId, user.user.id));
  assert.equal(
    (
      await apps[0]!.inject({
        url: "/api/auth/me",
        headers: { cookie: user.cookie },
      })
    ).statusCode,
    401,
  );
});
