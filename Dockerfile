# ─── Valence Docker Configuration ─────────────────────────────────────────────
# Build and run: docker-compose up -d
# Or standalone: docker build -t valence . && docker run -p 3001:3001 --env-file .env valence

FROM node:20-alpine

LABEL maintainer="Valence Team"
LABEL description="Valence — Smart EV Charging Station Platform"

# Create app directory
WORKDIR /app

# Install dependencies first (Docker layer caching)
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Start server
WORKDIR /app/backend
CMD ["node", "server.js"]
