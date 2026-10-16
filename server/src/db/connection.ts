import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
export function connect(url: string) {
  const pool = new pg.Pool({
    connectionString: url,
    max: 20,
    connectionTimeoutMillis: 5000,
  });
  return { pool, db: drizzle(pool, { schema }) };
}
export type Database = ReturnType<typeof connect>["db"];
