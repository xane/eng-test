import { readConfig } from "./config.js";
import { connect } from "./db/connection.js";
import { buildApp } from "./app.js";
const config = readConfig();
const { db, pool } = connect(config.DATABASE_URL);
const app = await buildApp(db, config);
app.addHook("onClose", async () => {
  await pool.end();
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close();
  });
try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
