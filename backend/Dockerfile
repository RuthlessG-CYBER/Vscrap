FROM node:26-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    YTDLP_PATH=/app/.venv/bin/yt-dlp \
    YTDLP_PYTHON=/app/.venv/bin/python \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# yt-dlp runs in Python; imageio-ffmpeg supplies the ffmpeg binary used for muxing.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install the locked Node dependencies before copying application source for better caching.
COPY package.json pnpm-lock.yaml ./
RUN npm install --global pnpm@9.15.9 \
    && pnpm install --prod --frozen-lockfile

COPY requirements.txt ./
RUN python3 -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir -r requirements.txt

COPY src ./src

# Run as the unprivileged user provided by the official Node image.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000)).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
