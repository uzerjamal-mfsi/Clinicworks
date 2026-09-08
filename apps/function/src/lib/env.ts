import { parseEnv } from "@clinicworks/shared";

export function getEnv() {
  const env = parseEnv({
    DATABASE_URL: process.env.DATABASE_URL,
    BLOB_CONNECTION_STRING: process.env.BLOB_CONNECTION_STRING,
    BLOB_CONTAINER_NAME: process.env.BLOB_CONTAINER_NAME,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_API_URL: process.env.AI_API_URL,
    AI_MODEL: process.env.AI_MODEL,
    NODE_ENV: process.env.NODE_ENV,
  });

  // Required variables (AI_API_URL is optional, defaults handled elsewhere)
  const required = ["DATABASE_URL", "BLOB_CONNECTION_STRING", "AI_API_KEY", "AI_MODEL"];
  const missing = required.filter((k) => !env[k as keyof typeof env]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
  // No strict URL validation here; resolveAiConfig will fallback if needed
  return env;
}
