FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/function/package.json ./apps/function/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install
COPY . .
RUN pnpm --filter @clinicworks/shared --filter @clinicworks/db build
RUN pnpm --filter function build
EXPOSE 7071
ENV AzureWebJobsScriptRoot=/app/apps/function/dist
ENV AzureFunctionsJobHost__Logging__Console__IsEnabled=true
ENV PORT=7071
CMD ["node", "apps/function/dist/src/local-server.js"]
