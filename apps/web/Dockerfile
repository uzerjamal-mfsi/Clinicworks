FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/function/package.json ./apps/function/package.json
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install
COPY . .
RUN pnpm --filter web build
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["pnpm", "--filter", "web", "start"]
