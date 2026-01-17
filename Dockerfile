# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

# We copy source code here, but the docker-compose 'volume'
# will overwrite this with your live local files anyway.
COPY . .

EXPOSE 3000

# Default command (can be overridden in docker-compose)
CMD ["npm", "run", "start"]
