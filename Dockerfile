# Dockerfile
FROM node:22-slim AS build-web
WORKDIR /app/apps/web
COPY apps/web/package.json ./
RUN npm install
COPY apps/web ./
RUN npm run build

FROM node:22-slim AS build-server
WORKDIR /app/apps/server
COPY apps/server/package.json ./
RUN npm install
COPY apps/server ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build-server /app/apps/server/node_modules ./node_modules
COPY --from=build-server /app/apps/server/dist ./dist
COPY --from=build-web /app/apps/web/dist ./web-dist
ENV KVASIR_WEB_DIST=/app/web-dist
ENV KVASIR_DATA_DIR=/data
ENV KVASIR_INGEST_DIR=/cwa-book-ingest
EXPOSE 8790
CMD ["node", "dist/server.js"]
