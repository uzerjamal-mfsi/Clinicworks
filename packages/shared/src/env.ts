import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BLOB_CONNECTION_STRING: z.string().min(1, "BLOB_CONNECTION_STRING is required"),
  BLOB_CONTAINER_NAME: z.string().min(1).default("documents"),
  AI_API_KEY: z.string().optional(),
  AI_API_URL: z.string().optional(),
  AI_MODEL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  return envSchema.parse(input);
}

export function safeParseEnv(input: Record<string, string | undefined>) {
  return envSchema.safeParse(input);
}
