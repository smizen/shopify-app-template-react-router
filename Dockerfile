# ── Stage 1 : Build ──────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2 : Runtime ────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/public ./public
COPY --from=build /app/shopify.app.toml ./shopify.app.toml

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
