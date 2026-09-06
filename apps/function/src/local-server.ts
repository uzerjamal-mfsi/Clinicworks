import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { health } from "./functions/health.js";
import { processDocument } from "./functions/processDocument.js";

type Handler = (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;

const routes: Record<string, { methods: string[]; handler: Handler }> = {
  "/api/health": { methods: ["GET"], handler: health },
  "/health": { methods: ["GET"], handler: health },
  "/api/process-document": { methods: ["POST"], handler: processDocument },
  "/process-document": { methods: ["POST"], handler: processDocument },
};

function createContext(): InvocationContext {
  return {
    log: (...args: unknown[]) => console.log(...args),
    error: (...args: unknown[]) => console.error(...args),
    warn: (...args: unknown[]) => console.warn(...args),
  } as unknown as InvocationContext;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function toHttpRequest(request: IncomingMessage, bodyText: string): HttpRequest {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(", "));
    else if (value !== undefined) headers.set(name, value);
  }
  return {
    method: request.method ?? "GET",
    url: request.url ?? "/",
    headers,
    query: new URLSearchParams(),
    params: {},
    user: null,
    json: async () => JSON.parse(bodyText) as unknown,
    text: async () => bodyText,
  } as unknown as HttpRequest;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

export function startLocalServer(port: number) {
  const server = createServer((request, response) => {
    void (async () => {
      const path = (request.url ?? "/").split("?")[0] ?? "/";
      const route = routes[path];
      if (!route) {
        sendJson(response, 404, { error: "Not found" });
        return;
      }
      if (!route.methods.includes(request.method ?? "")) {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }
      const bodyText = await readBody(request);
      const result = await route.handler(toHttpRequest(request, bodyText), createContext());
      response.statusCode = result.status ?? 200;
      response.setHeader("Content-Type", "application/json");
      for (const [name, value] of Object.entries(result.headers ?? {})) {
        response.setHeader(name, value);
      }
      response.end(JSON.stringify(result.jsonBody ?? {}));
    })().catch(() => {
      if (!response.headersSent) sendJson(response, 500, { error: "Local server failed" });
      else response.end();
    });
  });
  server.listen(port);
  return server;
}

const runDirectly = (process.argv[1] ?? "").endsWith("local-server.js");
if (runDirectly) {
  const port = Number(process.env.PORT ?? "7071");
  startLocalServer(Number.isFinite(port) ? port : 7071);
  console.log(`function local server listening on ${port}`);
}
