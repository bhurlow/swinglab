# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=24.1.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js"

# Next.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install pnpm
ARG PNPM_VERSION=10.11.0
RUN npm install -g pnpm@$PNPM_VERSION


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules and Rust
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    node-gyp \
    pkg-config \
    python-is-python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Rust and wasm-pack in one step, source env
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && \
    . $HOME/.cargo/env && \
    rustup target add wasm32-unknown-unknown && \
    cargo install wasm-pack
ENV PATH="/root/.cargo/bin:${PATH}"

# Install node modules
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Copy application code
COPY . .

# Build WASM module
RUN . $HOME/.cargo/env && cd engine && wasm-pack build --target web

# Build application with standalone output
RUN npx next build

# Remove development dependencies
RUN pnpm prune --prod


# Final stage for app image
FROM base

# Copy standalone build
COPY --from=build /app/.next/standalone /app
COPY --from=build /app/.next/static /app/.next/static

# Create public directory if it doesn't exist
RUN mkdir -p /app/public

# Copy public directory if it exists
COPY --from=build /app/public /app/public || true

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
