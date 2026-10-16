import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Database } from "./db/connection.js";
import { users, sessions } from "./db/schema.js";
import { AppError, roleFor } from "./domain.js";
const scrypt = promisify(scryptCallback);
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
async function verify(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export class AuthService {
  constructor(private db: Database) {}
  async login(username: string, password: string) {
    let user = await this.db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (!user) {
      // The unique constraint resolves concurrent registration on different instances.
      const [created] = await this.db
        .insert(users)
        .values({
          username,
          passwordHash: await passwordHash(password),
          role: roleFor(username),
        })
        .onConflictDoNothing()
        .returning();
      user =
        created ??
        (await this.db.query.users.findFirst({
          where: eq(users.username, username),
        }));
    }
    if (!user || !(await verify(password, user.passwordHash)))
      throw new AppError(401, "INVALID_CREDENTIALS", "Неверное имя или пароль");
    const token = randomBytes(32).toString("hex");
    await this.db.insert(sessions).values({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: sql`clock_timestamp() + interval '7 days'`,
    });
    return {
      token,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }
  async authenticate(token: string | undefined) {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new AppError(401, "UNAUTHORIZED", "Войдите в игру");
    const [row] = await this.db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          gt(sessions.expiresAt, sql`clock_timestamp()`),
        ),
      );
    if (!row)
      throw new AppError(401, "UNAUTHORIZED", "Сессия истекла. Войдите снова");
    return row;
  }
  async logout(token: string | undefined) {
    if (token)
      await this.db
        .delete(sessions)
        .where(eq(sessions.tokenHash, hashToken(token)));
  }
}
