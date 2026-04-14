FROM node:18-alpine

# Create and use a non-root user for security
RUN addgroup -S botgroup && adduser -S botuser -G botgroup

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Do not run as root
USER botuser

CMD ["node", "bot.js"]
