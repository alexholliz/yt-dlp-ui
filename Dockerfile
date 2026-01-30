FROM node:20-alpine

# Install yt-dlp and ffmpeg
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && pip3 install --no-cache-dir yt-dlp

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY src/ ./src/
COPY public/ ./public/

# Create necessary directories
RUN mkdir -p /config /downloads

# Environment variables
ENV NODE_ENV=production \
    PORT=8189 \
    DB_PATH=/config/yt-dlp-ui.sqlite \
    DOWNLOADS_PATH=/downloads \
    COOKIES_PATH=/config/cookies.txt \
    TZ=UTC

EXPOSE 8189

CMD ["node", "src/server.js"]
