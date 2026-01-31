FROM node:20-alpine AS base

# Install yt-dlp and ffmpeg
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && pip3 install --break-system-packages --no-cache-dir yt-dlp

WORKDIR /app

# Copy package files
COPY package*.json ./

# ============================================
# Test stage - includes all test dependencies
# ============================================
FROM base AS test

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy test files
COPY test/ ./test/

# Copy application files for testing
COPY src/ ./src/
COPY public/ ./public/

# Run tests
CMD ["npm", "test"]

# ============================================
# Production stage - lean image without tests
# ============================================
FROM base AS production

# Install only production dependencies
RUN npm ci --only=production

# Copy application files
COPY src/ ./src/
COPY public/ ./public/

# Create necessary directories
RUN mkdir -p /config /downloads

# Environment variables with defaults
ARG PORT=8189
ENV NODE_ENV=production \
    PORT=${PORT} \
    DB_PATH=/config/yt-dlp-ui.sqlite \
    DOWNLOADS_PATH=/downloads \
    COOKIES_PATH=/config/cookies.txt \
    TZ=UTC

EXPOSE ${PORT}

CMD ["node", "src/server.js"]
