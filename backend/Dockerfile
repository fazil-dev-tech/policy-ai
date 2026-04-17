FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS production
COPY . .
RUN mkdir -p uploads logs
EXPOSE 5000
USER node
CMD ["node", "server.js"]
