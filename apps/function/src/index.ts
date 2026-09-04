import { app } from "@azure/functions";
import { health } from "./functions/health.js";
import { processDocument } from "./functions/processDocument.js";

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: health,
});

app.http("processDocument", {
  methods: ["POST"],
  authLevel: "function",
  route: "process-document",
  handler: processDocument,
});
