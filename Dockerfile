FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
# Refresh job reuses this image, overriding CMD with: node dist-server/server/refresh-job.js
CMD ["node", "dist-server/server/index.js"]
