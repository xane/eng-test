import Fastify from "fastify";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { z, ZodError } from "zod";
import type { Database } from "./db/connection.js";
import type { Config } from "./config.js";
import { AuthService } from "./auth.js";
import { RoundService } from "./rounds.js";
import { AppError } from "./domain.js";
const loginSchema = z
  .object({
    username: z.string().trim().normalize().min(1).max(40),
    password: z.string().min(1).max(128),
  })
  .strict();
const idSchema = z.object({ id: z.uuid() });
export async function buildApp(
  db: Database,
  config: Config,
  options: { logger?: boolean; staticRoot?: string } = {},
) {
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 4096,
    requestTimeout: 10000,
  });
  const auth = new AuthService(db);
  const game = new RoundService(
    db,
    config.ROUND_DURATION,
    config.COOLDOWN_DURATION,
  );
  await app.register(cookie);
  app.addHook("onRequest", async (request, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin")
      .header("X-Frame-Options", "DENY");
    if (request.url.startsWith("/api/"))
      reply.header("Cache-Control", "no-store");
    // JSON-only mutations + SameSite=Strict prevent cross-site form submissions.
    if (
      request.method === "POST" &&
      !request.headers["content-type"]?.startsWith("application/json")
    )
      throw new AppError(415, "JSON_REQUIRED", "Ожидается application/json");
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Проверьте введённые данные",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    if (error instanceof AppError)
      return reply
        .code(error.status)
        .send({ code: error.code, message: error.message });
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode < 500
    )
      return reply
        .code(error.statusCode)
        .send({ code: "BAD_REQUEST", message: "Некорректный запрос" });
    request.log.error(error);
    return reply.code(500).send({
      code: "INTERNAL_ERROR",
      message: "Ошибка сервера. Попробуйте ещё раз",
    });
  });
  app.get("/api/health", async () => {
    await db.execute(sql`select 1`);
    return { status: "ok" };
  });
  app.post("/api/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const { token, user } = await auth.login(input.username, input.password);
    reply.setCookie("session", token, {
      httpOnly: true,
      secure: config.COOKIE_SECURE,
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 86400,
    });
    return user;
  });
  app.get("/api/auth/me", async (request) =>
    auth.authenticate(request.cookies.session),
  );
  app.post("/api/auth/logout", async (request, reply) => {
    await auth.logout(request.cookies.session);
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/rounds", async (request) => {
    await auth.authenticate(request.cookies.session);
    return game.list();
  });
  app.post("/api/rounds", async (request, reply) => {
    const user = await auth.authenticate(request.cookies.session);
    if (user.role !== "admin")
      throw new AppError(
        403,
        "FORBIDDEN",
        "Только администратор может создать раунд",
      );
    return reply.code(201).send(await game.create());
  });
  app.get("/api/rounds/:id", async (request) => {
    const user = await auth.authenticate(request.cookies.session);
    return game.detail(idSchema.parse(request.params).id, user.id);
  });
  app.post("/api/rounds/:id/taps", async (request) => {
    const user = await auth.authenticate(request.cookies.session);
    return game.tap(idSchema.parse(request.params).id, user);
  });
  const root = options.staticRoot ?? resolve("client/dist");
  if (existsSync(root)) {
    await app.register(staticFiles, { root });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/"))
        return reply.type("text/html").sendFile("index.html");
      return reply
        .code(404)
        .send({ code: "NOT_FOUND", message: "Маршрут не найден" });
    });
  }
  return app;
}
