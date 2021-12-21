FROM node:15.7.0-alpine

# -------------------
# Build app directory
# -------------------
WORKDIR /app

# Build dependencies
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY bin/ ./bin
COPY src/ ./src
COPY LICENSE.md ./

# -------------
# Start Service
# -------------
CMD ["./bin/start-worker.sh"]
