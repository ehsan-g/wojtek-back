# Dockerfile (Yarn Classic ready)
# Stage 1: build the application
FROM node:20-bullseye AS builder
WORKDIR /usr/src/app

# Install build-time deps (for sharp, bcrypt, native builds)
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 pkg-config libvips-dev && \
    rm -rf /var/lib/apt/lists/*

# Ensure a consistent Yarn version via Corepack (pin to Yarn v1.22.22 to match your lockfile)
RUN corepack enable && corepack prepare yarn@1.22.22 --activate

# Copy package manifests and the yarn.lock (important for reproducible installs)
COPY package.json yarn.lock ./

# Install dependencies (frozen lockfile => fails if yarn.lock out of sync)
RUN yarn install --frozen-lockfile --network-concurrency 1

# Copy source & build
COPY . .
RUN yarn build

# Stage 2: production image
FROM node:20-bullseye
WORKDIR /usr/src/app

# Copy built files and node_modules from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package.json ./

# Set production environment
ENV NODE_ENV=production
EXPOSE 2008

# Start the app
CMD ["node", "dist/main.js"]
