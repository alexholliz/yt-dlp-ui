FROM node:20-alpine

# Install yt-dlp and ffmpeg
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && pip3 install --break-system-packages --no-cache-dir yt-dlp

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY src/ ./src/
COPY public/ ./public/
COPY test/ ./test/

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
