FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Create data directory for persistent volume
RUN mkdir -p /app/data

EXPOSE 5000

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/data.db

CMD ["node", "dist/index.cjs"]
