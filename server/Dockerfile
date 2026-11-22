FROM node:22-alpine AS web-builder

WORKDIR /app/web
ARG VITE_ENABLE_DEMO=true
ENV VITE_ENABLE_DEMO=$VITE_ENABLE_DEMO

COPY web/package*.json ./
RUN npm ci
COPY web ./
RUN npm run build

FROM node:22-alpine AS server-builder

RUN apk add --no-cache openssl
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci
COPY server/prisma ./prisma
RUN ./node_modules/.bin/prisma generate

FROM node:22-alpine AS runner

RUN apk add --no-cache openssl
WORKDIR /app/server
ENV NODE_ENV=production

COPY --from=web-builder /app/web/dist /app/web/dist
COPY --from=server-builder /app/server/node_modules /app/server/node_modules
COPY server ./

RUN sed -i 's/\r$//' /app/server/docker-entrypoint.sh \
  && chmod +x /app/server/docker-entrypoint.sh \
  && mkdir -p /app/data

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/server/docker-entrypoint.sh"]
