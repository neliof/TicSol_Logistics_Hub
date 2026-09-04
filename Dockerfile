FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
COPY artsoft-sync/package*.json ./artsoft-sync/

# Install dependencies
RUN cd server && npm ci --only=production && cd ..
RUN cd artsoft-sync && npm ci --only=production && cd ..

# Copy application code
COPY server ./server
COPY artsoft-sync ./artsoft-sync
COPY database ./database

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3000

# Run server
CMD ["node", "server/server.js"]
