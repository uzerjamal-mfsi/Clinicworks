import { describe, it, expect } from "vitest";
import { parseEnv, safeParseEnv } from "./env.js";

describe("parseEnv", () => {
  it("parses valid env", () => {
    const env = parseEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      BLOB_CONNECTION_STRING: "UseDevelopmentStorage=true",
      BLOB_CONTAINER_NAME: "documents",
    });
    expect(env.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
    expect(env.BLOB_CONTAINER_NAME).toBe("documents");
  });

  it("defaults BLOB_CONTAINER_NAME", () => {
    const env = parseEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      BLOB_CONNECTION_STRING: "UseDevelopmentStorage=true",
    });
    expect(env.BLOB_CONTAINER_NAME).toBe("documents");
  });

  it("fails when required missing", () => {
    const result = safeParseEnv({
      BLOB_CONNECTION_STRING: "UseDevelopmentStorage=true",
    });
    expect(result.success).toBe(false);
  });
});
