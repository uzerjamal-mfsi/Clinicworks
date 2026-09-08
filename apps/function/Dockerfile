FROM mcr.microsoft.com/azure-functions/node:4-node22

ENV AzureWebJobsScriptRoot=/home/site/wwwroot/apps/function \
  AzureFunctionsJobHost__Logging__Console__IsEnabled=true

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /home/site/wwwroot

# Copy package manifests for workspace resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/function/package.json ./apps/function/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY apps/web/package.json ./apps/web/package.json

# Install workspace dependencies
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy source code and build packages
COPY . .
RUN pnpm --filter @clinicworks/shared --filter @clinicworks/db build
RUN pnpm --filter function build