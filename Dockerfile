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

# Install npm dependencies
RUN npm install

# Install CRE CLI
RUN bash -c "curl -fsSL https://cre.chain.link/install.sh | bash"
ENV PATH="/root/.cre/bin:${PATH}"

# Clone cre-orchestrator repository
RUN git clone https://github.com/Constellation-team/cre-orchestrator.git /cre-orchestrator

# Install Bun globally
RUN npm install -g bun

# Install workflow dependencies
WORKDIR /cre-orchestrator/workflows
RUN bun install

# Return to app directory
WORKDIR /app

# Copy application code
COPY . .

# Expose port (Render assigns PORT environment variable)
EXPOSE 10000

# Start the production server
CMD ["npx", "tsx", "server.production.ts"]
