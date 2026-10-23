FROM node:22-alpine AS builder

WORKDIR /app

# Build frontend
COPY web/package*.json ./web/
RUN cd web && npm ci
COPY web ./web
RUN cd web && npm run build

# Build backend
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server ./
RUN npx prisma generate

EXPOSE 4000
CMD ["node", "src/index.js"]
