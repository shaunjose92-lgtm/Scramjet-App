# Sydney-hostable Scramjet server (Fly.io or another Australian host)
# Node 22 is required by the Fastify 5 dependency; the original Node 18 image was outdated.
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# A pnpm lockfile ships with this project, not a package-lock.json.
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY public ./public
COPY src ./src
COPY scripts ./scripts

EXPOSE 8080
CMD ["node", "src/index.js"]
