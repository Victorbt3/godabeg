# Node app Dockerfile - High Compatibility for Railway
FROM node:18-bullseye

# Install build tools in case sqlite3 or other native modules need to compile
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install ALL dependencies (including dev) to ensure build tools are available
# but use --build-from-source for native modules if needed
RUN npm install

# Copy the rest of the application
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start command
CMD ["node", "server.js"]
