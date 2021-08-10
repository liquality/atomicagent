FROM node:15.7.0-alpine

# -----------------
# Export env config
# -----------------
ARG MONGO_CONNECT_URI
ENV MONGO_CONNECT_URI ${MONGO_CONNECT_URI}

# -------------------
# Build app directory
# -------------------
WORKDIR /app

COPY package*.json ./
COPY package-lock.json ./

RUN npm run install

# Bundle app source
COPY . .

EXPOSE 3030

# ---------
# Start app
# ---------
CMD ["./bin/start-api.sh"]
