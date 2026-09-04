import { describe, it, expect } from "vitest";
import { parseEnv } from "@clinicworks/shared";

describe("web env", () => {
  it("validates env", () => {
    const env = parseEnv({
      DATABASE_URL: "postgresql://clinicworks:clinicworks@localhost:5432/clinicworks",
      BLOB_CONNECTION_STRING: "UseDevelopmentStorage=true",
    });
    expect(env.BLOB_CONTAINER_NAME).toBe("documents");
  });
});
