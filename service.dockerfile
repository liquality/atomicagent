FROM node:15.7.0-alpine

# ---------------
# Load env params
# ---------------
ARG ENV_ALIAS
ENV ENV_ALIAS ${ENV_ALIAS}
ARG DB_PASSWORD
ENV DB_PASSWORD ${DB_PASSWORD}

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

# Load environment config
COPY env/${ENV_ALIAS}/config.${ENV_ALIAS}.toml ./config.toml

# -------------
# Start Service
# -------------
EXPOSE 3030

CMD ["./bin/start-service.sh"]
