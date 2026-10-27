# ==============================================================================
# SiteScope - OCI Containerfile (Optimized for Podman Rootless Execution)
# ==============================================================================

# Stage 1: Build static web assets
FROM docker.io/library/node:20-alpine AS builder
WORKDIR /app

# Install dependencies with caching
COPY package*.json ./
RUN npm ci

# Copy source and compile static distribution
COPY . .
RUN npm run build

# Stage 2: Serve using hardened, non-root, unprivileged Nginx server
FROM docker.io/nginxinc/nginx-unprivileged:alpine AS runtime

# Copy build artifacts to unprivileged web root
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Podman rootless runs unprivileged on port 8080 by default
EXPOSE 8080

# Health check without requiring curl
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
