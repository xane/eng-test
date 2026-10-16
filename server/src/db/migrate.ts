import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connect } from "./connection.js";
import { readConfig } from "../config.js";
const { db, pool } = connect(readConfig().DATABASE_URL);
try {
  await migrate(db, { migrationsFolder: "server/drizzle" });
  console.log("Migrations applied");
} finally {
  await pool.end();
}
