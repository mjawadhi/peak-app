FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Create persistent directories for volume mounts
RUN mkdir -p /app/data /app/uploads

EXPOSE 5000

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/data.db
ENV UPLOADS_DIR=/app/uploads

CMD ["node", "dist/index.cjs"]
