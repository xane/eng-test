import "dotenv/config";
import { z } from "zod";
const seconds = z.coerce.number().int().min(0).max(86400);
const configSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine(
      (value) => /^postgres(ql)?:/.test(value),
      "Expected a PostgreSQL URL",
    ),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("127.0.0.1"),
  ROUND_DURATION: seconds.refine((value) => value > 0).default(60),
  COOLDOWN_DURATION: seconds.default(30),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
export type Config = z.infer<typeof configSchema>;
export const readConfig = () => configSchema.parse(process.env);
