# ---------------------------------------
# Stage 1: Build the application
# ---------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including devDependencies for TypeScript)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source code and build
COPY . .
RUN npm run generate && npm run build

# Remove devDependencies to save space
RUN npm prune --production

# ---------------------------------------
# Stage 2: Create the production image
# ---------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Copy the "node_modules" from the builder stage (only prod deps remain)
COPY --from=builder /app/node_modules ./node_modules

# Copy the compiled JavaScript code
COPY --from=builder /app/dist ./dist


# Copy package.json so we can run npm scripts if needed
COPY --from=builder /app/package.json ./

COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/src/db/migrate.js ./src/db/migrate.js

# Set env to production for performance optimizations
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the app (Note: We run the migration script, then the app)
CMD ["sh", "-c", "npm run migrate:prod && npm run start"]