FROM node:15.7.0-alpine

# ---------------
# Load active env
# ---------------
ARG ENV_ALIAS
ENV ENV_ALIAS ${ENV_ALIAS}

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

# ---------
# Start API
# ---------
EXPOSE 3030

CMD ["./bin/start-api.sh"]
