import { app } from "@azure/functions";
import { health } from "./functions/health.js";

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
  handler: async (request, context) => {
    const { processDocument } = await import("./functions/processDocument.js");

    return processDocument(request, context);
  },
});
