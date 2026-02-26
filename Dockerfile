FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
