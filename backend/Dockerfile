FROM oven/bun:1

WORKDIR /app

COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile

COPY backend/src ./src

ENV PORT=3001
EXPOSE 3001

CMD ["bun", "src/index.ts"]
