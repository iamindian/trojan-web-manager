FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@8.15.9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/client/package.json packages/client/package.json
COPY packages/server/package.json packages/server/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages/client packages/client
COPY packages/server packages/server
RUN VITE_API_PREFIX=/api pnpm --filter @darren-z-m-lin/trojan-web-manager-client build \
    && pnpm --filter @darren-z-m-lin/trojan-web-manager-server exec babel src --out-dir dist --ignore "**/*.test.js" \
    && npm_config_ignore_scripts=true pnpm --filter @darren-z-m-lin/trojan-web-manager-server deploy --prod /runtime

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    API_PREFIX=/api \
    CLIENT_DIST=/app/public \
    TRUST_PROXY=true
WORKDIR /app
COPY --from=build --chown=node:node /runtime/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/server/dist ./dist
COPY --from=build --chown=node:node /app/packages/server/openapi.yaml ./openapi.yaml
COPY --from=build --chown=node:node /app/packages/client/dist ./public
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
