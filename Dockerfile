# Multi-stage build: build the React app, then run the Express server that
# serves both the API and the static frontend on one port.

# ---------- Stage 1: build frontend ----------
FROM node:20-alpine AS build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci || npm install
COPY client/ ./
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:20-alpine
WORKDIR /app

# server deps
COPY server/package*.json ./server/
RUN cd server && (npm ci --omit=dev || npm install --omit=dev)

# server source + built frontend
COPY server/ ./server/
COPY --from=build /app/client/dist ./client/dist

# Data directory. Mount a persistent disk here in production so the SQLite
# database survives redeploys (the app auto-seeds on first run if empty).
ENV DATA_DIR=/data
RUN mkdir -p /data

ENV PORT=4000
EXPOSE 4000
CMD ["node", "server/src/server.js"]
