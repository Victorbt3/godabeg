# Node app Dockerfile - Optimized for Railway
FROM node:18-bullseye-slim
WORKDIR /app
COPY package*.json ./
# Bullseye-slim is better than alpine for native modules
RUN npm install --production
COPY . .
ENV NODE_ENV=production
# Handle Railway PORT
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
