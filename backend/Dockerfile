FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS production
COPY . .
RUN mkdir -p uploads logs
EXPOSE 5000
USER node
CMD ["node", "server.js"]
