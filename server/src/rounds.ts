import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import type { Database } from "./db/connection.js";
import { rounds, scores, users } from "./db/schema.js";
import { AppError, roundStatus } from "./domain.js";
export class RoundService {
  constructor(
    private db: Database,
    private duration: number,
    private cooldown: number,
  ) {}
  async create() {
    // transaction_timestamp() is stable across all expressions in this statement.
    const [round] = await this.db
      .insert(rounds)
      .values({
        createdAt: sql`transaction_timestamp()`,
        startsAt: sql`transaction_timestamp() + ${this.cooldown} * interval '1 second'`,
        endsAt: sql`transaction_timestamp() + ${this.cooldown + this.duration} * interval '1 second'`,
      })
      .returning();
    return round!;
  }
  async list() {
    const rows = await this.db
      .select({ ...roundsColumns, serverNow: sql<string>`clock_timestamp()` })
      .from(rounds)
      .where(gt(rounds.endsAt, sql`statement_timestamp()`))
      .orderBy(asc(rounds.startsAt), asc(rounds.id));
    return rows.map((row) => ({
      ...row,
      status: roundStatus(row.startsAt, row.endsAt, new Date(row.serverNow)),
    }));
  }
  async detail(id: string, userId: string) {
    // One MVCC snapshot keeps the aggregate, personal score and winner consistent.
    return this.db.transaction(
      async (tx) => {
        const [round] = await tx
          .select({
            ...roundsColumns,
            serverNow: sql<string>`clock_timestamp()`,
          })
          .from(rounds)
          .where(eq(rounds.id, id));
        if (!round)
          throw new AppError(404, "ROUND_NOT_FOUND", "Раунд не найден");
        const status = roundStatus(
          round.startsAt,
          round.endsAt,
          new Date(round.serverNow),
        );
        const [mine] = await tx
          .select({ taps: scores.taps, score: scores.score })
          .from(scores)
          .where(and(eq(scores.roundId, id), eq(scores.userId, userId)));
        const [winner] =
          status === "finished"
            ? await tx
                .select({
                  id: users.id,
                  username: users.username,
                  score: scores.score,
                })
                .from(scores)
                .innerJoin(users, eq(users.id, scores.userId))
                .where(and(eq(scores.roundId, id), gt(scores.score, 0)))
                .orderBy(desc(scores.score), asc(users.username), asc(users.id))
                .limit(1)
            : [];
        return {
          ...round,
          status,
          mine: mine ?? { taps: 0, score: 0 },
          winner: winner ?? null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async tap(id: string, user: { id: string; role: string }) {
    return this.db.transaction(async (tx) => {
      // A DB row lock, shared by all Node processes, serializes changes to a round.
      // Always lock before reading the clock: a waiting request may cross ends_at.
      const [round] = await tx
        .select()
        .from(rounds)
        .where(eq(rounds.id, id))
        .for("update");
      if (!round) throw new AppError(404, "ROUND_NOT_FOUND", "Раунд не найден");
      // Keep microsecond precision in PostgreSQL, and evaluate the clock once.
      const result = await tx.execute<{ now: string; active: boolean }>(sql`
        with tick as materialized (select clock_timestamp() as now)
        select tick.now, (r.starts_at <= tick.now and tick.now < r.ends_at) as active
        from rounds r cross join tick where r.id = ${id}
      `);
      const now = new Date(result.rows[0]!.now);
      if (!result.rows[0]!.active)
        throw new AppError(409, "ROUND_NOT_ACTIVE", "Раунд сейчас не активен");
      if (user.role === "nikita")
        return {
          taps: 0,
          score: 0,
          totalScore: round.totalScore,
          serverNow: now.toISOString(),
        };
      const [mine] = await tx
        .insert(scores)
        .values({ roundId: id, userId: user.id, taps: 1, score: 1 })
        .onConflictDoUpdate({
          target: [scores.roundId, scores.userId],
          set: {
            taps: sql`${scores.taps} + 1`,
            score: sql`${scores.score} + case when (${scores.taps} + 1) % 11 = 0 then 10 else 1 end`,
          },
        })
        .returning({ taps: scores.taps, score: scores.score });
      const delta = mine!.taps % 11 === 0 ? 10 : 1;
      const [updated] = await tx
        .update(rounds)
        .set({ totalScore: sql`${rounds.totalScore} + ${delta}` })
        .where(eq(rounds.id, id))
        .returning({ totalScore: rounds.totalScore });
      return {
        ...mine!,
        totalScore: updated!.totalScore,
        serverNow: now.toISOString(),
      };
    });
  }
}
const roundsColumns = {
  id: rounds.id,
  createdAt: rounds.createdAt,
  startsAt: rounds.startsAt,
  endsAt: rounds.endsAt,
  totalScore: rounds.totalScore,
};
