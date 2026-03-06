# Use Ubuntu 24.04 with newer GLIBC (2.39)
FROM ubuntu:24.04

# Install Node.js 22, curl, bash, and other dependencies
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    git \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies (includes solc for compilation)
RUN npm install

# Copy application code
COPY . .

# Expose port (Render assigns PORT environment variable)
EXPOSE 10000

# Start the production server
CMD ["npx", "tsx", "server.production.ts"]
