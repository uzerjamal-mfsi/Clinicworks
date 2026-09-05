import { parseEnv } from "@clinicworks/shared";

export function getEnv() {
  return parseEnv({
    DATABASE_URL: process.env.DATABASE_URL,
    BLOB_CONNECTION_STRING: process.env.BLOB_CONNECTION_STRING,
    BLOB_CONTAINER_NAME: process.env.BLOB_CONTAINER_NAME,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    NODE_ENV: process.env.NODE_ENV,
  });
}
