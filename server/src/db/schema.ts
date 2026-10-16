import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  primaryKey,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    username: text().notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text({ enum: ["survivor", "admin", "nikita"] }).notNull(),
  },
  (t) => [check("valid_role", sql`${t.role} in ('survivor','admin','nikita')`)],
);
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_expiry_idx").on(t.expiresAt)],
);
export const rounds = pgTable(
  "rounds",
  {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    totalScore: bigint("total_score", { mode: "number" }).notNull().default(0),
  },
  (t) => [
    index("rounds_end_idx").on(t.endsAt),
    check(
      "round_time_order",
      sql`${t.endsAt} > ${t.startsAt} and ${t.startsAt} >= ${t.createdAt}`,
    ),
    check("round_score_positive", sql`${t.totalScore} >= 0`),
  ],
);
export const scores = pgTable(
  "scores",
  {
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    taps: bigint({ mode: "number" }).notNull().default(0),
    score: bigint({ mode: "number" }).notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.roundId, t.userId] }),
    check("score_positive", sql`${t.taps} >= 0 and ${t.score} >= 0`),
  ],
);
