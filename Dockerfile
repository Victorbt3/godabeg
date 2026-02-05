# Node app Dockerfile - High Compatibility for Railway
FROM node:18-bullseye

# Install build tools for native modules (like sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# IMPORTANT: Remove hardcoded PORT=3000 to let Railway inject its own
ENV NODE_ENV=production

# Start command
CMD ["node", "server.js"]
